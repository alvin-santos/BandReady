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
            'category' => 'required|string|in:feedback,question,other',
            'message' => 'required|string|min:10|max:8000',
        ]);

        $user = $request->user('sanctum');

        ContactMessage::query()->create([
            'user_id' => $user?->id,
            'name' => $data['name'],
            'email' => $data['email'],
            'category' => $data['category'],
            'message' => $data['message'],
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['ok' => true]);
    }
}
