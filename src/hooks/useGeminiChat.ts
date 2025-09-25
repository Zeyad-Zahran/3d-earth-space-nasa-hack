import { useState } from 'react';

const GEMINI_API_KEY = 'AIzaSyCt2mJuGaLaguGr_hFOwxgEjDcVCvKUgsk';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

export const useGeminiChat = () => {
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (userMessage: string, contextData?: any) => {
    setIsLoading(true);
    
    try {
      // Prepare system context about the space tracking system
      const systemContext = `
أنت مساعد ذكي متخصص في تحليل البيانات الفضائية لنظام تتبع الأقمار الصناعية والمخلفات الفضائية. 

معلومات النظام الحالي:
${contextData ? `
- الأقمار الصناعية: ${contextData.satellites?.count || 0} قمر صناعي
  - LEO: ${contextData.satellites?.types?.LEO || 0}
  - MEO: ${contextData.satellites?.types?.MEO || 0} 
  - GEO: ${contextData.satellites?.types?.GEO || 0}

- المخلفات الفضائية: ${contextData.debris?.count || 0} قطعة
  - عالية الخطورة: ${contextData.debris?.highRisk || 0}

- النيازك: ${contextData.meteors?.count || 0} نيزك
  - المقتربة (خلال 30 يوم): ${contextData.meteors?.approaching || 0}

- مخاطر الاصطدام: ${contextData.collisionRisks?.total || 0}
  - حرجة: ${contextData.collisionRisks?.critical || 0}
  - عالية: ${contextData.collisionRisks?.high || 0}

- التقاربات المحتملة: ${contextData.conjunctions?.total || 0}
  - قادمة: ${contextData.conjunctions?.upcoming || 0}
` : 'لا توجد بيانات حالياً'}

مهامك:
1. تحليل وشرح البيانات الفضائية بطريقة مبسطة
2. الإجابة على الأسئلة حول الأقمار الصناعية والمخلفات والنيازك
3. تقديم معلومات عن مخاطر الاصطدام والتقاربات
4. شرح المفاهيم العلمية بشكل واضح
5. تقديم توصيات أمنية عند الحاجة

أجب باللغة العربية بشكل مفصل ومفيد.
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
                { text: `سؤال المستخدم: ${userMessage}` }
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
      throw new Error('فشل في الاتصال بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sendMessage,
    isLoading
  };
};