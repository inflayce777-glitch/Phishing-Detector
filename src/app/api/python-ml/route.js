import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Python backend health check error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      status: 'offline',
      error: error.message,
      device: 'none',
      models: {
        multilingual_text: false,
        url_classifier: false
      }
    }, { status: 200 }); // Return 200 with offline status so UI can gracefully display offline badge
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Call the Python backend
    const response = await fetch('http://127.0.0.1:8000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Python backend error: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Python ML Proxy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
