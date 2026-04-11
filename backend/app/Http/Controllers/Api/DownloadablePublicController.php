<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Downloadable;
use App\Models\User;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DownloadablePublicController extends Controller
{
    public function index(Request $request)
    {
        $rows = Downloadable::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'title', 'slug', 'description', 'requires_pro', 'sort_order']);

        /** @var User|null $user */
        $user = $request->user('sanctum');
        $subscribed = $user && $user->isSubscribed();

        $payload = $rows->map(function (Downloadable $d) use ($user, $subscribed) {
            $locked = $d->requires_pro && ! $subscribed;
            $canDownload = $user && (! $d->requires_pro || $subscribed);

            return [
                'id' => $d->id,
                'title' => $d->title,
                'slug' => $d->slug,
                'description' => $d->description,
                'requires_pro' => (bool) $d->requires_pro,
                'locked' => $locked,
                'can_download' => $canDownload,
            ];
        });

        return response()->json(['resources' => $payload]);
    }

    public function download(Request $request, string $slug): StreamedResponse
    {
        /** @var User|null $user */
        $user = $request->user('sanctum');
        if (! $user) {
            abort(401, 'Sign in to download resources.');
        }

        $d = Downloadable::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        if ($d->requires_pro && ! $user->isSubscribed()) {
            abort(403, 'This resource requires BandReady Pro.');
        }

        $filename = $d->download_filename ?: 'document.txt';
        $mime = $d->mime_type ?: 'text/plain';
        $body = $d->body_text ?? '';

        return response()->streamDownload(function () use ($body) {
            echo $body;
        }, $filename, [
            'Content-Type' => $mime,
        ]);
    }
}
