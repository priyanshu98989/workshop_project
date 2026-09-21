const gemini = require('./geminiService');
const webSearch = require('./webSearchService');
const complaintRepository = require('../repositories/complaintRepository');
const { inferLocationFromImage } = require('./imageGeolocationService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const ASSISTANT_NAME = 'CivicEye Assistant';

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function detectIntent(message, hasImage) {
  if (hasImage) return 'image';

  const text = message.toLowerCase();
  const civicKeywords = [
    'complaint', 'report', 'dashboard', 'status', 'category', 'category',
    'pothole', 'garbage', 'kachra', 'gadda', 'streetlight', 'batti',
    'leak', 'leakage', 'drainage', 'obstruction', 'department', 'dept',
    'support score', 'duplicate', 'app', 'register', 'login', 'logout',
    'civiceye', 'civic', 'severity', 'resolve', 'pending', 'acknowledge',
    'photo kaise', 'report kaise', 'complaint kaise',
  ];
  const imageKeywords = [
    'photo', 'image', 'pic', 'picture', 'dekh', 'look', 'baar me', 'scanned',
  ];
  const looksLikeImageQuestion = imageKeywords.some((k) => text.includes(k)) &&
    /(kaise|kya|vibe|karti|karu|de batao|dikhao|bataye)/.test(text);

  if (civicKeywords.some((k) => text.includes(k))) return 'civic';
  if (looksLikeImageQuestion) return 'image';
  return 'web';
}

async function handleImageQuery({ message, history, imageBase64, mimeType }) {
  const lower = (message || '').toLowerCase();
  const asksLocation =
    /(kahan|location|jagah|kaun si jagah|place|where|se li|ki li|yahan|yahin)/.test(lower) &&
    /(photo|image|imag|pic|ye|is|ka)/.test(lower);

  if (asksLocation) {
    const loc = await inferLocationFromImage({ imageBase64, mimeType });
    if (loc && loc.found) {
      const parts = [
        `📍 Maine photo ke andar ke clues (signboard, landmark, text, architecture) dekh kar location trace ki hai — current location bilkul use nahi ki.`,
        `Bina current location ke iska best guess: **${loc.place_name || 'unknown place'}**` +
          (loc.city ? ` (${[loc.city, loc.state, loc.country].filter(Boolean).join(', ')})` : ''),
      ];
      if (loc.area_hint) parts.push(`Area hint: ${loc.area_hint}`);
      if (loc.landmarks && loc.landmarks.length) {
        parts.push(`Jo clues mile: ${loc.landmarks.slice(0, 5).join(', ')}`);
      }
      parts.push(`Coordinates: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} (confidence ${Math.round(loc.confidence * 100)}%)`);
      if (loc.evidence) parts.push(`Evidence: ${loc.evidence}`);
      return { type: 'image', message: clean(parts.join('\n')) };
    }
    return {
      type: 'image',
      message:
        '😅 Is photo se location ke clear clues nahi mile (koi dukaan/signboard/landmark nazar nahi aaya). Pin karke ya report page ke "AI Model se location trace" button se try karlen.',
    };
  }

  // Agentic step: classify the issue structurally so the assistant can recommend
  // the exact next backend action (create a complaint) with dept + priority.
  let civicAnalysis = null;
  try {
    const { classifyCivicIssue } = require('./aiService');
    const { resolveDepartmentName, computePriority } = require('./departmentService');
    const civic = await classifyCivicIssue(imageBase64, mimeType);
    if (civic && civic.category && civic.category !== 'other') {
      const departmentName = resolveDepartmentName(civic.category);
      const priority = computePriority(civic.severity, 0).priority;
      civicAnalysis = {
        category: civic.category,
        severity: civic.severity,
        confidence: civic.confidence,
        department: departmentName,
        priority,
        nextAction: 'create_complaint',
        description: civic.description || '',
      };
    }
  } catch (err) {
    logger.warn(`Assistant civic classification failed (${err.message})`);
  }

  try {
    const text = await gemini.generate({
      systemPrompt:
        'You are a friendly civic assistant inside a complaint-reporting app.\n' +
        'The user has attached an image. Analyze it carefully:\n' +
        '- Describe what is visible (in the user\u2019s language, usually Hindi/English).\n' +
        '- If it is a civic issue (pothole, garbage pile, broken streetlight, water leakage, road obstruction, drainage blockage), name it, suggest severity, and give short practical next steps.\n' +
        '- If it is NOT a civic issue (random photo, food, people, documents, memes, etc.), honestly say what it is and offer helpful tips.\n' +
        '- Answer any question the user asks about the image.\n' +
        '- Keep it helpful and under ~140 words.',
      history,
      userText: message || 'What do you see in this image?',
      imageBase64,
      mimeType,
      temperature: 0.3,
    });
    const base = { type: 'image', message: clean(text) };
    if (civicAnalysis) {
      base.message += `\n\n📋 AI ka fay sa: **${civicAnalysis.category.replace(/-/g, ' ')}** (${civicAnalysis.severity}), department: **${civicAnalysis.department}**, priority: **${civicAnalysis.priority}**. Isko report karne ke liye button dabaiye.`;
      base.aiAnalysis = civicAnalysis;
    }
    return base;
  } catch (err) {
    logger.warn(`Image analysis failed (${err.message})`);
    if (civicAnalysis) {
      return {
        type: 'image',
        aiAnalysis: civicAnalysis,
        message:
          `📋 AI classification: **${civicAnalysis.category}** (${civicAnalysis.severity}), department: **${civicAnalysis.department}**, priority: **${civicAnalysis.priority}**. ` +
          'Is civic issue ko report karne ke liye neeche button dabaiye.',
      };
    }
    return {
      type: 'image',
      message:
        '🙏 Aapki photo mil gai hai, lekin AI abhi thoda busy hai (high demand). Thodi der baad ek baar aur poochh lein — main turant analyze kar dunga.',
    };
  }
}

async function handleCivicQuery({ message, history, userId }) {
  const complaints = await complaintRepository.list();
  const brief = complaints
    .slice(0, 12)
    .map(
      (c, i) =>
        `${i + 1}. ${c.title || 'Untitled'} | category=${c.category} | status=${c.status} | severity=${c.severity}`
    )
    .join('\n');

  try {
    const text = await gemini.generate({
      systemPrompt:
        `You are ${ASSISTANT_NAME}, the built-in helper of the CivicEye 2.0 civic issue reporting app.\n` +
        'Answer questions about the app: how reporting works, complaint categories (pothole, garbage, water leakage, broken streetlight, road obstruction, drainage blockage, other), statuses (Pending, Acknowledged, In Progress, Resolved), duplicate detection, support score, departments, auth/login.\n' +
        `These are the current complaints in the system:\n${brief || '(no complaints yet - tell the user to report the first one)'}\n` +
        'If asked about a specific complaint, use the list. For things outside the app, point them to a web search.\n' +
        'Reply in the user\u2019s language, under ~120 words.',
      history,
      userText: message,
      temperature: 0.3,
    });
    return { type: 'civic', message: clean(text) };
  } catch (err) {
    logger.warn(`Civic answer failed (${err.message})`);
    const current = complaints
      .map((c, i) => `${i + 1}. ${c.category} — ${c.status} (${c.severity})`)
      .join('\n');
    return {
      type: 'civic',
      message: current
        ? `Mujhe abhi AI se detail jawab nahi mil saka, par ye raha app ka live data:\n${current}\n\nBina AI ke bhi ye status aapke kaam ka hai. 🙏`
        : 'Abhi koi complaint nahi hai — Report Issue me jake pehli complaint banaiye! 📷',
    };
  }
}

async function handleWebQuery({ message, history }) {
  const results = await webSearch.search(message);
  const fallbackUrl = `https://duckduckgo.com/?q=${encodeURIComponent(message)}`;

  let text;
  if (results.length > 0) {
    const snippets = results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet || '(no snippet)'}`)
      .join('\n\n');

    try {
      text = await gemini.generate({
        systemPrompt:
          'You researched this question using live web search results.\n' +
          'Give a concise answer (2-4 short bullets) based ONLY on these results, then mention the sources by number.\n' +
          'Reply in the user\u2019s language. If results do not answer the question, say so honestly.\n' +
          'Under ~120 words.',
        history,
        userText: `Question: ${message}\n\nSearch results:\n${snippets}`,
        temperature: 0.3,
      });
    } catch (err) {
      logger.warn(`Web summary failed (${err.message})`);
      text = `Neeche aapko live web search ke results mile hain — inhe browse karke sahi jawab pa sakein. 🔍`;
    }
  } else {
    text = `Sirf vagah se live search ka result abhi nahi mila, lekin aap neeche ke button se browser mein dekh sakte hain.`;
  }

  return {
    type: 'web',
    message: clean(text),
    results: results.length
      ? results.map((r) => ({ title: r.title, url: r.url }))
      : [{ title: 'Open in Browser', url: fallbackUrl }],
  };
}

async function chat({ userId, message, imageBase64, mimeType, history = [] }) {
  const text = clean(message);
  if (!text && !imageBase64) {
    throw new AppError('Please send a message or attach an image.', 400);
  }

  const intent = detectIntent(text, !!imageBase64);
  logger.info(`Assistant intent="${intent}" (image=${!!imageBase64}) user=${userId}`);

  if (intent === 'civic') {
    return handleCivicQuery({ message: text, history, userId });
  }
  if (intent === 'image') {
    if (!imageBase64) {
      return {
        type: 'civic',
        message: `Aapne image ke baare mein poocha hai, lekin abhi koi photo attach nahi hai. 📷 Message ke saath ek photo bhejne ki koshish kijiye.`,
      };
    }
    return handleImageQuery({ message: text, history, imageBase64, mimeType });
  }
  return handleWebQuery({ message: text, history });
}

module.exports = { chat };