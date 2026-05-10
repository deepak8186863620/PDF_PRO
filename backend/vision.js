import 'dotenv/config';

const API_KEY = process.env.GOOGLE_VISION_API_KEY;
const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;

if (!API_KEY) {
  console.error('⚠️  GOOGLE_VISION_API_KEY is not set in .env');
} else {
  console.log('✅ GOOGLE_VISION_API_KEY loaded successfully');
}

/**
 * Helper: convert input to a base64 string safe for the Vision REST API.
 * Accepts Buffer, base64 string (with or without data URI prefix).
 */
function toBase64(imageContent) {
  if (Buffer.isBuffer(imageContent)) {
    return imageContent.toString('base64');
  }
  if (typeof imageContent === 'string' && imageContent.includes('base64,')) {
    return imageContent.split('base64,')[1];
  }
  return imageContent; // already a plain base64 string
}

/**
 * Performs OCR on a base64 encoded image string or a Buffer.
 * @param {string|Buffer} imageContent - Base64 string or Buffer of the image
 * @returns {Promise<string>} - Extracted text
 */
export async function performOCR(imageContent, mimeType = "image/jpeg") {
  try {
    const content = toBase64(imageContent);
    const isPdf = mimeType === "application/pdf";
    
    let url = VISION_API_URL;
    let body;

    if (isPdf) {
      url = `https://vision.googleapis.com/v1/files:annotate?key=${API_KEY}`;
      body = {
        requests: [
          {
            inputConfig: { content, mimeType: "application/pdf" },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      };
    } else {
      body = {
        requests: [
          {
            image: { content },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const msg = data.error?.message || `HTTP ${response.status}`;
      throw new Error(msg);
    }
    
    // Vision API often embeds errors inside the responses array
    if (data.responses && data.responses[0]?.error) {
      throw new Error(data.responses[0].error.message || "Vision API returned an internal error.");
    }

    if (isPdf) {
      let fullText = "";
      const responses = data.responses?.[0]?.responses || [];
      for (const res of responses) {
        if (res.fullTextAnnotation?.text) {
          fullText += res.fullTextAnnotation.text + "\n\n";
        }
      }
      return fullText.trim();
    } else {
      const fullText = data.responses?.[0]?.fullTextAnnotation?.text;
      if (fullText) return fullText;

      const annotations = data.responses?.[0]?.textAnnotations;
      if (annotations && annotations.length > 0) {
        return annotations[0].description;
      }
      return '';
    }
  } catch (err) {
    console.error('Google Cloud Vision OCR Error:', err.message);
    throw err;
  }
}

/**
 * Performs structured OCR on a base64 encoded image string or a Buffer.
 * @param {string|Buffer} imageContent - Base64 string or Buffer of the image
 * @returns {Promise<Array>} - Array of structured text objects with bounding boxes
 */
export async function performStructuredOCR(imageContent, mimeType = "image/jpeg") {
  try {
    const content = toBase64(imageContent);
    const isPdf = mimeType === "application/pdf";

    let url = VISION_API_URL;
    let body;

    if (isPdf) {
      url = `https://vision.googleapis.com/v1/files:annotate?key=${API_KEY}`;
      body = {
        requests: [
          {
            inputConfig: { content, mimeType: "application/pdf" },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      };
    } else {
      body = {
        requests: [
          {
            image: { content },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      };
    }

    console.log('Calling Vision API URL (Structured):', url.split('key=')[0] + 'key=HIDDEN');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('Vision API Response Status (Structured):', response.status);

    if (!response.ok || data.error) {
      const msg = data.error?.message || `HTTP ${response.status}`;
      console.error('Vision API Error Data (Structured):', JSON.stringify(data.error || data, null, 2));
      throw new Error(msg);
    }
    
    // Vision API often embeds errors inside the responses array
    if (data.responses && data.responses[0]?.error) {
      throw new Error(data.responses[0].error.message || "Vision API returned an internal error.");
    }

    const structuredData = [];
    
    // Extract pages correctly whether it's a PDF (files:annotate) or Image (images:annotate)
    let allPages = [];
    if (isPdf) {
      const responses = data.responses?.[0]?.responses || [];
      for (const res of responses) {
        if (res.fullTextAnnotation?.pages) {
          allPages = allPages.concat(res.fullTextAnnotation.pages);
        }
      }
    } else {
      allPages = data.responses?.[0]?.fullTextAnnotation?.pages || [];
    }

    for (const page of allPages) {
      for (const block of (page.blocks || [])) {
        for (const paragraph of (block.paragraphs || [])) {
          let paragraphText = '';
          for (const word of (paragraph.words || [])) {
            const wordText = word.symbols.map((s) => s.text).join('');
            paragraphText += wordText + ' ';
          }

          const vertices = paragraph.boundingBox?.vertices;
          if (vertices && vertices.length === 4) {
            const v0x = vertices[0].x || 0;
            const v0y = vertices[0].y || 0;
            const v1x = vertices[1].x || 0;
            const v1y = vertices[1].y || 0;
            const v2x = vertices[2].x || 0;
            const v2y = vertices[2].y || 0;
            const v3x = vertices[3].x || 0;
            const v3y = vertices[3].y || 0;

            const x = Math.min(v0x, v3x);
            const y = Math.min(v0y, v1y);
            const width = Math.max(v1x, v2x) - x;
            const height = Math.max(v2y, v3y) - y;

            structuredData.push({
              text: paragraphText.trim(),
              x,
              y,
              width,
              height,
            });
          }
        }
      }
    }

    return structuredData;
  } catch (err) {
    console.error('Google Cloud Vision Structured OCR Error:', err.message);
    throw err;
  }
}
