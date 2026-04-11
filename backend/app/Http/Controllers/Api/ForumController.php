<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ForumCategory;
use App\Models\ForumReply;
use App\Models\ForumThread;
use Illuminate\Http\Request;

class ForumController extends Controller
{
    public function categories()
    {
        $rows = ForumCategory::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->withCount('threads')
            ->get();

        return response()->json($rows);
    }

    public function threads(Request $request, int $categoryId)
    {
        $category = ForumCategory::query()->findOrFail($categoryId);
        $perPage = min(max((int) $request->query('per_page', 20), 5), 50);

        $paginator = ForumThread::query()
            ->where('forum_category_id', $category->id)
            ->with('user:id,name')
            ->withCount('replies')
            ->orderByDesc('updated_at')
            ->paginate($perPage);

        return response()->json([
            'category' => [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'description' => $category->description,
            ],
            'threads' => $paginator,
        ]);
    }

    public function showThread(int $id)
    {
        $thread = ForumThread::query()
            ->with([
                'category:id,name,slug',
                'user:id,name',
                'replies' => function ($q) {
                    $q->orderBy('id')->with('user:id,name');
                },
            ])
            ->findOrFail($id);

        return response()->json($thread);
    }

    public function storeThread(Request $request, int $categoryId)
    {
        $user = $request->user('sanctum');
        if (! $user?->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email verification required.'], 403);
        }

        ForumCategory::query()->findOrFail($categoryId);

        $data = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string|min:3|max:12000',
        ]);

        $thread = ForumThread::query()->create([
            'forum_category_id' => $categoryId,
            'user_id' => $user->id,
            'title' => $data['title'],
            'body' => $data['body'],
        ]);

        $thread->load('user:id,name', 'category:id,name,slug');

        return response()->json($thread, 201);
    }

    public function storeReply(Request $request, int $threadId)
    {
        $user = $request->user('sanctum');
        if (! $user?->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email verification required.'], 403);
        }

        $thread = ForumThread::query()->findOrFail($threadId);

        $data = $request->validate([
            'body' => 'required|string|min:1|max:12000',
        ]);

        $reply = ForumReply::query()->create([
            'forum_thread_id' => $thread->id,
            'user_id' => $user->id,
            'body' => $data['body'],
        ]);

        $thread->touch();

        $reply->load('user:id,name');

        return response()->json($reply, 201);
    }
}
