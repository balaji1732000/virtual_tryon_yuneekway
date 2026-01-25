import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseAuthedClient(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const type = formData.get("type") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const pageUrl = formData.get("pageUrl") as string;
    const pagePath = formData.get("pagePath") as string;
    const browserInfo = formData.get("browserInfo") as string;
    const screenshot = formData.get("screenshot") as File | null;

    // Validation
    if (!type || !title || !description) {
      return NextResponse.json(
        { error: "Missing required fields: type, title, description" },
        { status: 400 }
      );
    }

    if (!["feature_request", "bug_report", "feedback", "improvement"].includes(type)) {
      return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 });
    }

    if (title.length < 3 || title.length > 200) {
      return NextResponse.json(
        { error: "Title must be between 3 and 200 characters" },
        { status: 400 }
      );
    }

    if (description.length < 10 || description.length > 5000) {
      return NextResponse.json(
        { error: "Description must be between 10 and 5000 characters" },
        { status: 400 }
      );
    }

    let screenshotUrl: string | null = null;

    // Upload screenshot if provided
    if (screenshot && screenshot.size > 0) {
      // Validate file size (max 5MB)
      if (screenshot.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Screenshot size must be less than 5MB" },
          { status: 400 }
        );
      }

      // Validate file type
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!allowedTypes.includes(screenshot.type)) {
        return NextResponse.json(
          { error: "Screenshot must be PNG, JPG, JPEG, or WebP" },
          { status: 400 }
        );
      }

      try {
        const fileExt = screenshot.name.split(".").pop();
        const fileName = `${user.id}/${randomUUID()}.${fileExt}`;
        const arrayBuffer = await screenshot.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("feedback-screenshots")
          .upload(fileName, buffer, {
            contentType: screenshot.type,
            upsert: false,
          });

        if (uploadError) {
          console.error("[feedback] Screenshot upload error:", uploadError);
          // Continue without screenshot rather than failing entire submission
          screenshotUrl = null;
        } else {
          // Get public URL
          const { data: urlData } = supabase.storage
            .from("feedback-screenshots")
            .getPublicUrl(fileName);
          screenshotUrl = urlData.publicUrl;
        }
      } catch (uploadErr) {
        console.error("[feedback] Screenshot upload exception:", uploadErr);
        // Continue without screenshot
        screenshotUrl = null;
      }
    }

    // Parse browser info
    let parsedBrowserInfo = null;
    try {
      parsedBrowserInfo = browserInfo ? JSON.parse(browserInfo) : null;
    } catch (e) {
      console.warn("[feedback] Failed to parse browser info:", e);
    }

    // Insert feedback submission
    const { data: feedbackData, error: insertError } = await supabase
      .from("feedback_submissions")
      .insert({
        user_id: user.id,
        user_email: user.email,
        user_name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
        type,
        title: title.trim(),
        description: description.trim(),
        page_url: pageUrl || null,
        page_path: pagePath || null,
        browser_info: parsedBrowserInfo,
        user_agent: req.headers.get("user-agent") || null,
        screenshot_url: screenshotUrl,
        status: "open",
        priority: "medium",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[feedback] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to submit feedback. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feedbackId: feedbackData.id,
    });
  } catch (error: any) {
    console.error("[feedback] Unexpected error:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}


