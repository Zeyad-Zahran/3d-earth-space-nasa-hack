import { useState } from 'react';

const GEMINI_API_KEY = 'AIzaSyAepPAkAhAL-db7nmnerqejjOpKQYRiunA';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

export const useGeminiChat = () => {
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (userMessage: string, contextData?: any) => {
    setIsLoading(true);
    
    try {
      // Prepare system context about the space tracking system
      const systemContext = `
You are an intelligent assistant specialized in analyzing space data for satellite tracking and space debris monitoring systems.

Current system information:
${contextData ? `
- Satellites: ${contextData.satellites?.count || 0} satellites
  - LEO: ${contextData.satellites?.types?.LEO || 0}
  - MEO: ${contextData.satellites?.types?.MEO || 0} 
  - GEO: ${contextData.satellites?.types?.GEO || 0}

- Space Debris: ${contextData.debris?.count || 0} pieces
  - High Risk: ${contextData.debris?.highRisk || 0}

- Meteors/NEOs: ${contextData.meteors?.count || 0} objects
  - Approaching (within 30 days): ${contextData.meteors?.approaching || 0}

- Collision Risks: ${contextData.collisionRisks?.total || 0}
  - Critical: ${contextData.collisionRisks?.critical || 0}
  - High: ${contextData.collisionRisks?.high || 0}

- Potential Conjunctions: ${contextData.conjunctions?.total || 0}
  - Upcoming: ${contextData.conjunctions?.upcoming || 0}
` : 'No data currently available'}

Your tasks:
1. Analyze and explain space data in a simplified manner
2. Answer questions about satellites, debris, and meteors
3. Provide information about collision risks and conjunctions
4. Explain scientific concepts clearly
5. Provide security recommendations when needed

IMPORTANT: Respond in the same language the user asks in. If they ask in English, respond in English. If they ask in Arabic, respond in Arabic.
`;

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemContext },
                { text: `User question: ${userMessage}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH", 
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error('Invalid response format from Gemini API');
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error('Failed to connect to AI. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sendMessage,
    isLoading
  };
};
