import { NextRequest, NextResponse } from 'next/server';

// Skills options matching the frontend component
const SKILLS_OPTIONS = [
  { label: 'image2text', value: 'image2text' },
  { label: 'tts', value: 'tts' },
  { label: 'research', value: 'research' },
  { label: 'imagegen', value: 'imagegen' },
  { label: 'multimodal', value: 'multimodal' },
  { label: 'pdf extraction', value: 'pdf_extraction' },
  { label: 'ocr', value: 'ocr' },
  { label: 'text generation', value: 'text_generation' },
  { label: 'code generation', value: 'code_generation' },
  { label: 'data analysis', value: 'data_analysis' },
  { label: 'web scraping', value: 'web_scraping' },
  { label: 'api integration', value: 'api_integration' },
  { label: 'automation', value: 'automation' },
  { label: 'chat', value: 'chat' },
  { label: 'translation', value: 'translation' },
  { label: 'summarization', value: 'summarization' },
  { label: 'sentiment analysis', value: 'sentiment_analysis' },
  { label: 'classification', value: 'classification' },
];

// Input/output type options
const IO_TYPE_OPTIONS = [
  { label: 'Text', value: 'text' },
  { label: 'Image', value: 'image' },
  { label: 'Audio', value: 'audio' },
  { label: 'Video', value: 'video' },
];

// Subnet type options
const SUBNET_TYPE_OPTIONS = [
  { label: 'App', value: 'App' },
  { label: 'Agent', value: 'Agent' },
  { label: 'API server', value: 'API server' },
  { label: 'MCP server', value: 'MCP server' },
];

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const response = {
      skills: SKILLS_OPTIONS,
      inputTypes: IO_TYPE_OPTIONS,
      outputTypes: IO_TYPE_OPTIONS,
      subnetTypes: SUBNET_TYPE_OPTIONS,
    };

    return new NextResponse(JSON.stringify(response), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching subnet options:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
    });
  }
}