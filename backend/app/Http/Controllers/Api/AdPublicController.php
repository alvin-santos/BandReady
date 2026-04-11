<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ad;
use Illuminate\Http\Request;

class AdPublicController extends Controller
{
    public function index(Request $request)
    {
        $location = $request->query('location');
        $q = Ad::query()->where('active', true);
        if ($location) {
            $q->where('location', $location);
        }

        return response()->json($q->get());
    }

    public function click(int $id)
    {
        $ad = Ad::query()->findOrFail($id);
        $ad->increment('clicks');

        return response()->json(['ok' => true]);
    }
}
