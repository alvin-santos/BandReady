<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SiteVisit;
use Illuminate\Http\Request;

class SiteTrafficController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'visitor_id' => ['required', 'uuid'],
            'path' => ['required', 'string', 'max:512'],
            'referrer' => ['nullable', 'string', 'max:1024'],
        ]);

        $user = $request->user('sanctum');

        SiteVisit::query()->create([
            'visitor_id' => $validated['visitor_id'],
            'user_id' => $user?->id,
            'path' => $validated['path'],
            'referrer' => $validated['referrer'] ?? null,
        ]);

        return response()->noContent();
    }
}
