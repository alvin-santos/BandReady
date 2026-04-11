<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\Request;

class AdminContactMessageController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 30), 5), 100);

        $paginator = ContactMessage::query()
            ->with('user:id,name,email')
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json($paginator);
    }

    public function markRead(Request $request, int $id)
    {
        $row = ContactMessage::query()->findOrFail($id);
        if ($row->read_at === null) {
            $row->update(['read_at' => now()]);
        }

        return response()->json(['ok' => true, 'read_at' => $row->fresh()->read_at?->toIso8601String()]);
    }

    public function markUnread(Request $request, int $id)
    {
        $row = ContactMessage::query()->findOrFail($id);
        $row->update(['read_at' => null]);

        return response()->json(['ok' => true]);
    }
}
