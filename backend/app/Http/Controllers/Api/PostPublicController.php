<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\Request;

class PostPublicController extends Controller
{
    public function index(Request $request)
    {
        $publishedOnly = $request->boolean('published', true);

        $q = Post::query();
        if ($publishedOnly) {
            $q->where('published', true);
        }

        $rows = $q
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get(['id', 'title', 'slug', 'excerpt', 'featured_image', 'published', 'created_at', 'updated_at']);

        return response()->json(['posts' => $rows]);
    }

    public function show(string $slug)
    {
        $post = Post::query()
            ->where('slug', $slug)
            ->where('published', true)
            ->firstOrFail(['id', 'title', 'slug', 'content', 'excerpt', 'featured_image', 'created_at', 'updated_at']);

        return response()->json(['post' => $post]);
    }
}

