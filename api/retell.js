// This is a Node.js serverless function
// It handles requests from Retell AI, calls the Gemini API, and sends a response.

export default async function handler(req, res) {
  // We only accept POST requests from Retell
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Your Gemini API Key should be stored securely as an environment variable
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    console.error("Gemini API key is not set.");
    // Send a generic error message back to Retell
    return res.status(200).json({ content: "I am having trouble connecting to my brain. Please try again later." });
  }

  try {
    const { interaction_type, transcript, metadata } = req.body;

    // Handle the first interaction of the call with a welcome message
    if (interaction_type === "call_details") {
      return res.status(200).json({
        content: "Namaste! Main Krishi Rakshak hu, aapka AI sahayak. Aap kya jaankari chahte hain?"
      });
    }

    // Get the last thing the user said
    const userQuery = transcript[transcript.length - 1]?.content;
    if (!userQuery) {
      return res.status(200).json({ content: "I'm sorry, I didn't catch that. Could you please repeat?" });
    }
    
    // Get the farm data context we passed from the website
    const farmDataContext = metadata?.farm_data || "No farm data available.";

    // --- Prepare the request for Gemini API ---
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiPayload = {
      contents: [
        {
          role: "user",
          parts: [{ "text": userQuery }]
        }
      ],
      systemInstruction: {
        role: "model",
        parts: [
          {
            "text": `आप एक सहायक कृषि विशेषज्ञ, कृषि रक्षक हैं। आपको किसान की मदद करनी है। किसान से हमेशा हिंदी में बात करें। किसान के खेत का वर्तमान डेटा यह है: ${farmDataContext}. इस डेटा का उपयोग करके उनके सवालों का जवाब दें। अपने जवाब छोटे और बातचीत के उपयुक्त रखें।`
          }
        ]
      }
    };
    
    // --- Call the Gemini API ---
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API request failed with status ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "I am not sure how to respond to that.";

    // Send the AI's response back to Retell
    res.status(200).json({ content: aiResponse });

  } catch (error) {
    console.error("Error in Retell webhook:", error);
    // In case of an error, send a safe response back to Retell
    res.status(200).json({ content: "I seem to be having some technical difficulties. Please try again in a moment." });
  }
}
