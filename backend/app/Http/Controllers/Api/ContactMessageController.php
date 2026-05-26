<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\Request;

class ContactMessageController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:190',
            'message' => 'required|string|min:10|max:8000',
            // Keep backwards compatibility with the old contact form.
            'category' => 'sometimes|string|in:feedback,question,other,advertising',
        ]);

        $user = $request->user('sanctum');
        $category = $data['category'] ?? 'feedback';

        ContactMessage::query()->create([
            'user_id' => $user?->id,
            'name' => $data['name'],
            'email' => $data['email'],
            'category' => $category,
            'message' => $data['message'],
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['ok' => true]);
    }
}
