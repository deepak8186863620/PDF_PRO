const fs = require('fs');

async function testPdfToWord() {
  const formData = new FormData();
  formData.append('files', new Blob(['fake pdf content'], { type: 'application/pdf' }), 'test.pdf');
  
  try {
    const uploadRes = await fetch('https://pdf-pro-dx2i.onrender.com/api/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!uploadRes.ok) {
      console.log('Upload failed:', await uploadRes.text());
      return;
    }
    const { files } = await uploadRes.json();
    console.log('Uploaded file ID:', files[0].id);
    
    const wordRes = await fetch('https://pdf-pro-dx2i.onrender.com/api/pdf/to-word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: files[0].id })
    });
    
    console.log('PDF to Word status:', wordRes.status);
    console.log('PDF to Word response:', await wordRes.text());
    
  } catch (err) {
    console.error('Error:', err);
  }
}

testPdfToWord();
