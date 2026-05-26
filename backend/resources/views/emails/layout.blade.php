<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>@yield('title', $appName ?? config('app.name'))</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(180deg,#fff1f2 0%,#eef2f9 48%,#eef2f9 100%);min-height:100%;">
    <tr>
        <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
                <tr>
                    <td align="center" style="padding-bottom:20px;">
                        <span style="display:inline-block;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
                            {{ $appName ?? config('app.name', 'BandReady') }}
                        </span>
                    </td>
                </tr>
                <tr>
                    <td style="background:#ffffff;border-radius:16px;border:1px solid #e8d8dc;box-shadow:0 8px 24px rgba(15,23,42,0.06);padding:32px 28px;">
                        @yield('content')
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding-top:20px;font-size:12px;line-height:1.5;color:#64748b;">
                        @yield('footer')
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
