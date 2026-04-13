<?php

use App\Http\Controllers\GoogleAuthController;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/sitemap.xml', function () {
    $base = rtrim((string) config('app.frontend_url'), '/');
    if ($base === '') {
        $base = rtrim((string) config('app.url'), '/');
    }
    /** @var list<string> $paths Public SPA routes worth indexing (fragment-free). */
    $paths = [
        '/',
        '/why-bandready',
        '/practice-disclaimer',
        '/contact',
        '/forum',
        '/login',
        '/register',
        '/subscription',
        '/rankings',
        '/resources',
        '/exam/start',
    ];
    $lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
    foreach ($paths as $path) {
        $loc = htmlspecialchars($base.$path, ENT_XML1 | ENT_COMPAT, 'UTF-8');
        $priority = $path === '/' ? '1.0' : '0.7';
        $lines[] = "  <url><loc>{$loc}</loc><changefreq>weekly</changefreq><priority>{$priority}</priority></url>";
    }
    $lines[] = '</urlset>';

    return response(implode("\n", $lines), 200)->header('Content-Type', 'application/xml; charset=UTF-8');
})->name('sitemap');

Route::get('/robots.txt', function () {
    $lines = [
        'User-agent: *',
        'Allow: /',
        '',
    ];
    $sitemapUrl = rtrim((string) config('app.url'), '/').'/sitemap.xml';
    $lines[] = 'Sitemap: '.$sitemapUrl;

    return response(implode("\n", $lines), 200)->header('Content-Type', 'text/plain; charset=UTF-8');
})->name('robots');

Route::get('/', function () {
    return view('welcome');
});

Route::get('/auth/google', [GoogleAuthController::class, 'redirect'])
    ->middleware('throttle:30,1');
Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])
    ->middleware('throttle:30,1');

Route::get('/email/verify/{id}/{hash}', function (Request $request) {
    $user = User::query()->findOrFail($request->route('id'));
    if (! hash_equals((string) $request->route('hash'), sha1($user->getEmailForVerification()))) {
        abort(403);
    }
    if ($user->markEmailAsVerified()) {
        event(new Verified($user));
    }

    return redirect()->away(config('app.frontend_url').'/login?verified=1');
})->middleware(['signed', 'throttle:6,1'])->name('verification.verify');
