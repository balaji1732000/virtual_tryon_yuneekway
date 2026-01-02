import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const operationId = searchParams.get('operationId');

        if (!operationId) {
            return NextResponse.json({ error: 'Missing operationId' }, { status: 400 });
        }

        const client = getGeminiClient();
        const operation = await client.operations.get({
            operation: { name: operationId } as any
        });

        if (operation.done) {
            if (operation.error) {
                return NextResponse.json({ error: operation.error }, { status: 500 });
            }

            const result = (operation as any).result;
            if (result && result.generatedVideos && result.generatedVideos.length > 0) {
                const video = result.generatedVideos[0];
                // Note: In production, you might want to download and store the video
                // For now, we return the URI or bytes if available
                return NextResponse.json({
                    status: 'done',
                    videoUri: video.video?.uri,
                    videoBytes: video.video?.videoBytes
                });
            }
        }

        return NextResponse.json({ status: 'running' });
    } catch (error: any) {
        console.error('Video status error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
