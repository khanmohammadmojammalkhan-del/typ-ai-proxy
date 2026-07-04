
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
    const safeContext = (context || '').slice(0, 6000);

    const systemPrompt = `তুমি "TYP Support" — TYP Championship নামের একটা Bengali eFootball টুর্নামেন্ট কমিউনিটির অফিসিয়াল সাহায্যকারী বট।
নিচে কমিউনিটির নিয়মাবলী ও তথ্য (knowledge base) দেওয়া আছে। শুধুমাত্র এই তথ্যের ভিত্তিতে উত্তর দাও।
নিয়ম:
- বাংলায় উত্তর দাও, সংক্ষিপ্ত ও স্পষ্টভাবে (৪-৫ লাইনের বেশি না, দরকার হলে বুলেট পয়েন্ট ব্যবহার করো)
- যদি knowledge base এ উত্তর না থাকে, সৎভাবে বলো যে তোমার কাছে নির্দিষ্ট তথ্য নেই এবং Admin-কে জিজ্ঞেস করতে বলো
- কখনো নিজে থেকে নিয়ম বানিয়ে বলবে না বা অনুমান করে উত্তর দিবে না
- TYP Championship সম্পর্কিত না এমন প্রশ্নের (যেমন সাধারণ জ্ঞান, রাজনীতি ইত্যাদি) উত্তর দিবে না, বরং বলবে তুমি শুধু TYP সংক্রান্ত প্রশ্নে সাহায্য করতে পারো

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
          generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
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
