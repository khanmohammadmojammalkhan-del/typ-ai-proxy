

export default async function handler(req, res) {
  // CORS headers — যেকোনো origin থেকে call করা যাবে
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const { question, context } = req.body || {};

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question missing' });
    }

    // প্রশ্ন খুব বড় হলে abuse ঠেকাতে কেটে দেওয়া
    const safeQuestion = question.slice(0, 800);
    const safeContext = (context || '').slice(0, 20000);

    const systemPrompt = `তুমি "TYP Support" — TYP Championship নামের একটা Bengali eFootball টুর্নামেন্ট কমিউনিটির অফিসিয়াল সাহায্যকারী বট।
নিচে কমিউনিটির পূর্ণাঙ্গ নিয়মাবলী ও FAQ (knowledge base) দেওয়া আছে। শুধুমাত্র এই তথ্যের ভিত্তিতে উত্তর দাও।

সাধারণ প্রশ্নের ক্ষেত্রে:
- বাংলায় উত্তর দাও, সংক্ষিপ্ত ও স্পষ্টভাবে (৪-৫ লাইনের বেশি না, দরকার হলে বুলেট পয়েন্ট ব্যবহার করো)
- যদি knowledge base এ উত্তর না থাকে, সৎভাবে বলো যে তোমার কাছে নির্দিষ্ট তথ্য নেই এবং Admin-কে জিজ্ঞেস করতে বলো
- কখনো নিজে থেকে নিয়ম বানিয়ে বলবে না বা অনুমান করে উত্তর দিবে না
- TYP Championship সম্পর্কিত না এমন প্রশ্নের উত্তর দিবে না, বরং বলবে তুমি শুধু TYP সংক্রান্ত প্রশ্নে সাহায্য করতে পারো

যখন কেউ একটা নির্দিষ্ট ম্যাচের ঘটনা/বিতর্ক বর্ণনা করে (যেমন "প্রতিপক্ষ backpass খেলেছে", "সে disconnect হয়ে গেছিলো" ইত্যাদি) এবং জানতে চায় কী হবে — তখন তুমি একজন "Decision Assistant", চূড়ান্ত বিচারক না:
- প্রাসঙ্গিক নিয়ম উল্লেখ করে বিশ্লেষণ করো ঘটনাটা কোন নিয়মের আওতায় পড়ে এবং সাধারণত কী সিদ্ধান্ত হয়
- সবসময় স্পষ্টভাবে বলো এটা শুধু নিয়ম অনুযায়ী প্রাথমিক ধারণা, চূড়ান্ত সিদ্ধান্ত না — কারণ প্রকৃত রায়ের জন্য ভিডিও প্রমাণ ও Admin Panel-এর যাচাই লাগে
- কখনো নিজে থেকে "তুমি জিতেছ/হেরেছ" বা "তাকে ব্যান করা হবে" এই ধরনের চূড়ান্ত রায় দিবে না — শুধু "নিয়ম অনুযায়ী এরকম হওয়ার কথা, তবে চূড়ান্ত সিদ্ধান্তের জন্য Admin Panel-এ ভিডিওসহ অভিযোগ জানাও" এভাবে বলবে
- একতরফা বর্ণনা শুনে অন্য পক্ষকে দোষী সাব্যস্ত করবে না; মনে রাখবে তুমি শুধু একটা পক্ষের বক্তব্য শুনছ

Knowledge Base:
${safeContext}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: safeQuestion }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(502).json({ error: 'gemini_error', detail: errText });
    }

    const data = await geminiRes.json();
    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না।';

    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', detail: String(e) });
  }
}
