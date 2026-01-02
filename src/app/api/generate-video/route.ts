import { NextRequest, NextResponse } from 'next/server';
import { generateVideo } from '@/lib/gemini';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const prompt = formData.get('prompt') as string;
        const dressImage = formData.get('dressImage') as File;

        if (!prompt || !dressImage) {
            return NextResponse.json({ error: 'Missing prompt or dress image' }, { status: 400 });
        }

        const dressBase64 = Buffer.from(await dressImage.arrayBuffer()).toString('base64');

        const operation = await generateVideo(prompt, dressBase64);

        return NextResponse.json({
            operationId: operation.name,
            status: operation.done ? 'done' : 'running'
        });
    } catch (error: any) {
        console.error('Video generation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
