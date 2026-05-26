@extends('emails.layout')

@section('title', 'Verify your email — '.$appName)

@section('content')
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">
        Email verification
    </p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:#0f172a;">
        Hi {{ $userName }},
    </h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#334155;">
        Thanks for signing up for <strong>{{ $appName }}</strong>. Please confirm your email address so you can use forum posts,
        saved progress, and other account features.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
        <tr>
            <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#2563eb,#6366f1);">
                <a href="{{ $verificationUrl }}"
                   style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                    Verify email address
                </a>
            </td>
        </tr>
    </table>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#64748b;">
        This link expires in <strong>{{ $expireMinutes }} minutes</strong>. If the button does not work, copy and paste this URL into your browser:
    </p>
    <p style="margin:0 0 20px;font-size:12px;line-height:1.5;word-break:break-all;">
        <a href="{{ $verificationUrl }}" style="color:#2563eb;text-decoration:underline;">{{ $verificationUrl }}</a>
    </p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">
        If you did not create a {{ $appName }} account, you can ignore this message.
    </p>
@endsection

@section('footer')
    <p style="margin:0 0 4px;">
        Independent CELPIP- and IELTS-style practice — not affiliated with official test providers.
    </p>
    <p style="margin:0;">
        <a href="{{ $frontendUrl }}" style="color:#2563eb;text-decoration:none;">{{ $frontendUrl }}</a>
    </p>
@endsection
