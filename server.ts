import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const app = express();
app.use(express.json({ limit: '10mb' }));
const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// LLM-powered voice parsing endpoint for expenses and shopping list items
app.post('/api/gemini/parse-voice', async (req, res) => {
  const { text, audio, mimeType, categories } = req.body || {};
  const hasText = typeof text === 'string' && text.trim().length > 0;
  const hasAudio = typeof audio === 'string' && audio.trim().length > 0;

  if (!hasText && !hasAudio) {
    return res.status(400).json({ error: 'Missing spoken text or audio input' });
  }

  const cleanText = hasText ? text.trim() : '';
  const knownCategories = Array.isArray(categories) && categories.length > 0 
    ? categories.join(', ') 
    : 'groceries, food, utilities, rent, travel, medical, shopping, education, investments, other';

  const schema = {
    type: Type.OBJECT,
    properties: {
      type: { 
        type: Type.STRING, 
        enum: ['expenses', 'shopping', 'both', 'unrecognized'],
        description: 'expenses if only costs/expenses; shopping if only items to buy; both if user mentioned BOTH expenses with prices AND shopping list items in the same input; unrecognized if questions, chitchat, web searches, or speech unrelated to expenses/shopping.'
      },
      interpretation: {
        type: Type.STRING,
        description: 'Clean concise summary of what was understood, e.g. "Understood 2 expenses (₹30) and 2 shopping items to buy".'
      },
      explanation: {
        type: Type.STRING,
        description: 'Short helpful explanation if unrecognized, or brief guidance for the user.'
      },
      expenses: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Clean, capitalized item or service name (e.g. Chai, Coffee, Electricity)' },
            amount: { type: Type.NUMBER, description: 'Numeric cost in currency (e.g. 10, 20, 30.5)' },
            category: { type: Type.STRING, description: 'Best matching category key from available categories' }
          },
          required: ['name', 'amount']
        }
      },
      shoppingItems: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { 
              type: Type.STRING, 
              description: 'Clean, capitalized item name to buy INCLUDING full quantity, unit, or price specification if mentioned (e.g. "2 Kilo Batata", "Aatpav Kotambir", "Pav Kilo Bhindi", "20 Rs ki Sev", "20 Rs ke Murmura", "5 Rs Chips", "500g Paneer", "2L Doodh"). Never drop or omit quantity, units, or price descriptors!' 
            },
            category: { type: Type.STRING, description: 'Best matching category key' }
          },
          required: ['name']
        }
      }
    },
    required: ['type']
  };

  const systemInstruction = `You are the intelligent voice intent parser for the collaborative expense manager 'Hisaab Barabar'.
The user spoke or typed input in English, Hinglish, Hindi, or Marathi (often informal colloquial speech with speech-to-text phonetic inaccuracies).
Available category keys: ${knownCategories}.

Intelligent Category Mapping (Simple, MECE Indian Household Categories):
- groceries: Daily groceries, ration, kitchen essentials, vegetables (sabzi), fruits, dairy/milk, household supplies & toiletries (e.g. toothbrush, toothpaste, soap, detergent, shampoo).
- food: Dining out, hotel, Swiggy, Zomato, street food, snacks, evening chai, coffee, samosa, bakery, sweets.
- utilities: Electricity (bijli), mobile recharge, WiFi/broadband, gas cylinder, water bill, DTH/cable.
- rent: House rent, society maintenance, domestic help (maid / cook / bai / safai salary), home repairs.
- travel: Petrol, diesel, vehicle fuel, auto rickshaw, cab (Ola/Uber/Rapido), metro, train/bus tickets, FASTag/toll, parking.
- medical: Pharmacy, chemist, medicines (dawai), doctor consultation, clinic/hospital, diagnostic lab tests, dentist.
- shopping: Clothes (kapde), shoes, footwear, online shopping (Amazon/Flipkart/Meesho), electronics, home appliances, bedsheets, personal items.
- education: School fees, college fees, coaching/tuition classes, books, notebooks, stationery, uniforms.
- investments: SIP, mutual funds, RD/FD, PPF, gold, loan EMI (home/car/personal loan), insurance premiums (LIC).
- other: General miscellaneous, gifts, shagun lifafa, pooja samagri, unexpected one-offs.

Cultural Context & Indian/Marathi/Hindi Language Understanding:
- Languages: English, Hindi, Marathi, and Hinglish.
- Common Produce & Grocery Terms:
  - 'batata' / 'aloo' -> Potato / Batata
  - 'kanda' / 'pyaz' -> Onion / Kanda
  - 'kotambir' / 'kothmir' / 'dhaniya' -> Kotambir / Dhaniya
  - 'bhindi' -> Bhindi (Okra)
  - 'paneer', 'doodh' / 'dudh' (milk), 'dahi' (curd), 'chaas' / 'taak' (buttermilk), 'shrikhand', 'ghee'
  - 'sev', 'murmura' / 'kurmura' / 'churmura' (puffed rice), 'farsan', 'chivda', 'chips'
  - 'atta', 'chawal' / 'tandool', 'dal' / 'daal', 'poha', 'suji' / 'rava', 'besan'
  - 'adrak' / 'aale' (ginger), 'lasun' / 'lahsun' (garlic), 'tamatar' / 'tomato', 'mirchi' / 'chilli'
- Indian Fractional & Vernacular Measurement Units:
  - 'aatpav' / 'athpav' -> 125g (half pav) -> e.g. 'aatpav kotambir' -> 'Aatpav Kotambir'
  - 'pav kilo' / 'pav' -> 250g (quarter kilo) -> e.g. 'pav kilo bhindi' -> 'Pav Kilo Bhindi'
  - 'aadha kilo' / 'ardha kilo' -> 500g (half kilo) -> e.g. 'aadha kilo tamatar' -> '500g Tamatar'
  - 'paun kilo' -> 750g (3/4 kilo)
  - 'kilo' / 'kg' -> e.g. '2 kilo batata' -> '2 Kilo Batata'
  - 'gaddi' -> bunch -> e.g. 'ek gaddi palak' -> '1 Gaddi Palak'
  - 'packet', 'pouch', 'thaili', 'dabba', 'litre' / 'l'

Price-Based Shopping Items (Items to buy specified by rupee value):
- Indian shoppers frequently specify items by price to buy (e.g. "20 rs ki sev", "20 rs ke murmura", "5rs chips", "10 rs ka dhaniya", "50 rs ka paneer").
- If the phrase indicates an item to BUY or grocery item specified by price:
  - Preserve the price descriptor in the shopping item name!
  - Examples:
    - "20 rs ki sev" -> name: "20 Rs ki Sev"
    - "20 rs ke murmura" -> name: "20 Rs ke Murmura"
    - "5rs chips" / "5 rs wala chips" -> name: "5 Rs Chips"
    - "10 rs ka dhaniya" -> name: "10 Rs ka Dhaniya"
    - "50 rs ka paneer" -> name: "50 Rs ka Paneer"

CRITICAL: Preserve Quantities & Units for Shopping Items:
- When extracting items for the shopping list, ALWAYS keep and include the quantity, count, weight, volume, pack size, or price specification directly in the item name!
- NEVER drop, ignore, or strip the quantity, measurement units, or price!
  Examples:
  - "2 kilo batata" -> name: "2 Kilo Batata"
  - "aatpav kotambir" -> name: "Aatpav Kotambir"
  - "pav kilo bhindi" -> name: "Pav Kilo Bhindi"
  - "20 rs ki sev and 20 rs ke murmura" -> name: "20 Rs ki Sev", name: "20 Rs ke Murmura"
  - "5rs chips" -> name: "5 Rs Chips"
  - "buy 2 litres of milk" -> name: "2L Doodh" (or "2L Milk")
  - "500 grams paneer" -> name: "500g Paneer"
  - "5 kg atta and 1 kg sugar" -> name: "5kg Atta", name: "1kg Sugar"
  - "2 packets of brown bread" -> name: "2 Packets Brown Bread"

Speech-To-Text / Phonetic Typo Restoration:
- Speech-to-text transcriptions can be phonetically imperfect or missing punctuation.
  For example: 'try ten' or 'child ten' -> 'Chai' ₹10; 'cofi' -> 'Coffee'; 'bred' -> 'Bread'; 'dood'/'doodh' -> 'Milk'.
- Use semantic and cultural context to reconstruct the exact intended items and amounts with proper capitalization.

Multi-Intent Handling:
- The user CAN mention BOTH expenses (with amounts/prices) AND shopping items to buy in the same utterance!
  Example: 'chai 10 coffee 20 and need to buy 2 kilo batata and aatpav kotambir' -> type: 'both', expenses: [Chai 10, Coffee 20], shoppingItems: [2 Kilo Batata, Aatpav Kotambir].
  Example: 'petrol 500 and 20 rs ki sev aur 20 rs ke murmura' -> type: 'both', expenses: [Petrol 500], shoppingItems: [20 Rs ki Sev, 20 Rs ke Murmura].
- If only expenses with amounts already paid are mentioned: set type to 'expenses'.
- If only items to buy are mentioned: set type to 'shopping'.
- If conversational chitchat, web questions, or random gibberish: set type to 'unrecognized'. Provide a friendly explanation.
- Note on dietary preference: Core users are pure vegetarian. Do NOT suggest or use non-vegetarian or egg examples in prompts. If a user explicitly speaks any item, parse it faithfully.
- Always normalize item names with proper capitalization.`;

  const promptContents: any = hasAudio
    ? [
        {
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: audio
          }
        },
        'Transcribe this spoken voice recording, correct phonetic speech inaccuracies, and extract financial expenses and shopping items according to the schema.'
      ]
    : `Parse this spoken voice input: "${cleanText}"`;

  // First try gemini-3.1-flash-lite with zero thinking budget for minimal latency, fallback to gemini-3.8-flash if needed
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: promptContents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.expenses?.length > 0 && parsed.shoppingItems?.length > 0) {
      parsed.type = 'both';
      if (!parsed.interpretation) {
        parsed.interpretation = `Understood ${parsed.expenses.length} expenses & ${parsed.shoppingItems.length} shopping items`;
      }
    } else if (parsed.expenses?.length > 0 && !parsed.interpretation) {
      parsed.interpretation = `Understood ${parsed.expenses.length} expenses`;
    } else if (parsed.shoppingItems?.length > 0 && !parsed.interpretation) {
      parsed.interpretation = `Understood ${parsed.shoppingItems.length} shopping items`;
    }
    return res.json({ success: true, data: parsed });
  } catch (primaryErr) {
    console.warn('Primary model failed, attempting fallback:', primaryErr);
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptContents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });
      const parsed = JSON.parse(fallbackResponse.text || '{}');
      if (parsed.expenses?.length > 0 && parsed.shoppingItems?.length > 0) {
        parsed.type = 'both';
        if (!parsed.interpretation) {
          parsed.interpretation = `Understood ${parsed.expenses.length} expenses & ${parsed.shoppingItems.length} shopping items`;
        }
      } else if (parsed.expenses?.length > 0 && !parsed.interpretation) {
        parsed.interpretation = `Understood ${parsed.expenses.length} expenses`;
      } else if (parsed.shoppingItems?.length > 0 && !parsed.interpretation) {
        parsed.interpretation = `Understood ${parsed.shoppingItems.length} shopping items`;
      }
      return res.json({ success: true, data: parsed });
    } catch (fallbackErr: any) {
      console.error('All Gemini voice parse models failed:', fallbackErr);
      const errStr = String(fallbackErr?.message || fallbackErr || '');
      const isQuota = errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('429') || errStr.includes('quota') || errStr.includes('rate limit');
      const isDailyQuota = isQuota && (errStr.toLowerCase().includes('day') || errStr.toLowerCase().includes('daily'));

      return res.status(isQuota ? 429 : 500).json({ 
        error: isQuota ? (isDailyQuota ? 'DAILY_QUOTA_EXHAUSTED' : 'RATE_LIMIT_EXCEEDED') : 'Failed to parse voice transcript with Gemini',
        message: isDailyQuota
          ? 'Daily Gemini request limit has been reached for today. It will reset tomorrow at midnight UTC. You can continue using manual entry anytime.'
          : (isQuota
              ? 'Gemini request rate limit reached. Please wait a minute and try again, or use manual entry.'
              : 'Service temporarily unavailable. Please try again.'),
        details: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
        isQuota,
        isDailyQuota
      });
    }
  }
});

async function startServer() {
  const server = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server, overlay: false },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
