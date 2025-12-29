export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { prompt } = req.body;

  // These come from your Vercel Dashboard (Settings > Environment Variables)
  const GEMINI_KEY = process.env.GEMINI_KEY;
  const OPENAI_KEY = process.env.OPENAI_KEY;
  const AIML_KEY = process.env.AIML_KEY;

  try {
    // 1. Ask all three models at the same time
    const [geminiRes, openaiRes, aimlRes] = await Promise.allSettled([
      fetch(`generativelanguage.googleapis.com{GEMINI_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }).then(r => r.json()),

      fetch("api.openai.com", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{role: "user", content: prompt}] })
      }).then(r => r.json()),

      fetch("api.aimlapi.com", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AIML_KEY}` },
        body: JSON.stringify({ model: "mistralai/mistral-7b-instruct-v0.2", messages: [{role: "user", content: prompt}] })
      }).then(r => r.json())
    ]);

    // 2. Prepare the data for Nicol to summarize
    const modelData = `
      Gemini: ${geminiRes.value?.candidates?.[0]?.content?.parts?.[0]?.text || "No response"}
      OpenAI: ${openaiRes.value?.choices?.[0]?.message?.content || "No response"}
      AI/ML: ${aimlRes.value?.choices?.[0]?.message?.content || "No response"}
    `;

    // 3. Final Summary by Nicol (using Gemini for speed)
    const finalCall = await fetch(`generativelanguage.googleapis.com{GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: `You are Nicol by Flexi AI Labs. Summarize these responses: ${modelData}` }] }] 
      })
    }).then(r => r.json());

    const resultText = finalCall.candidates[0].content.parts[0].text;

    res.status(200).json({ text: resultText });
  } catch (error) {
    res.status(500).json({ text: "Nicol's brain is offline. Check API keys." });
  }
}
