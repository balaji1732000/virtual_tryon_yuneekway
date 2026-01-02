import { NextRequest, NextResponse } from 'next/server';
import { generateModelWithDress, generateVirtualTryOn } from '@/lib/gemini';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const type = formData.get('type') as string; // 'pack' or 'tryon'

        if (type === 'tryon') {
            const modelImage = formData.get('modelImage') as File;
            const dressImage = formData.get('dressImage') as File;
            const additionalPrompt = formData.get('additionalPrompt') as string || "";

            if (!modelImage || !dressImage) {
                return NextResponse.json({ error: 'Missing images' }, { status: 400 });
            }

            const modelBase64 = Buffer.from(await modelImage.arrayBuffer()).toString('base64');
            const dressBase64 = Buffer.from(await dressImage.arrayBuffer()).toString('base64');

            const response = await generateVirtualTryOn(modelBase64, dressBase64, additionalPrompt);

            // Extract image from response
            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (!imagePart || !imagePart.inlineData) {
                return NextResponse.json({ error: 'No image generated' }, { status: 500 });
            }

            return NextResponse.json({
                image: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType,
                text: response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text
            });
        }
        else if (type === 'pack') {
            const dressImage = formData.get('dressImage') as File;
            const referenceImage = formData.get('referenceImage') as File;
            const angle = formData.get('angle') as string;
            const skinTone = formData.get('skinTone') as string;
            const region = formData.get('region') as string;
            const background = formData.get('background') as string;
            const gender = formData.get('gender') as string;
            const aspectRatio = formData.get('aspectRatio') as string;
            const additionalPrompt = formData.get('additionalPrompt') as string || "";

            if (!dressImage) {
                return NextResponse.json({ error: 'Missing dress image' }, { status: 400 });
            }

            const dressBase64 = Buffer.from(await dressImage.arrayBuffer()).toString('base64');
            const referenceBase64 = referenceImage ? Buffer.from(await referenceImage.arrayBuffer()).toString('base64') : undefined;

            const response = await generateModelWithDress(
                dressBase64,
                angle,
                skinTone,
                region,
                background,
                referenceBase64,
                additionalPrompt,
                gender,
                aspectRatio
            );

            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (!imagePart || !imagePart.inlineData) {
                return NextResponse.json({ error: 'No image generated' }, { status: 500 });
            }

            return NextResponse.json({
                image: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType,
                text: response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text
            });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    } catch (error: any) {
        console.error('Generation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
