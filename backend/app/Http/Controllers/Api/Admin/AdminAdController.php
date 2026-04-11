<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Ad;
use Illuminate\Http\Request;

class AdminAdController extends Controller
{
    public function index()
    {
        return response()->json(Ad::query()->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'location' => 'required|string|max:64',
            'script' => 'nullable|string',
            'image' => 'nullable|string|max:2048',
            'link' => 'nullable|string|max:2048',
            'active' => 'boolean',
        ]);

        $ad = Ad::query()->create($data);

        return response()->json($ad, 201);
    }

    public function update(Request $request, int $id)
    {
        $ad = Ad::query()->findOrFail($id);
        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'location' => 'sometimes|string|max:64',
            'script' => 'nullable|string',
            'image' => 'nullable|string|max:2048',
            'link' => 'nullable|string|max:2048',
            'active' => 'boolean',
        ]);
        $ad->update($data);

        return response()->json($ad);
    }

    public function destroy(int $id)
    {
        Ad::query()->whereKey($id)->delete();

        return response()->json(['ok' => true]);
    }
}
