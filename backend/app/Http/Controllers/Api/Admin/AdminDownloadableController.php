<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Downloadable;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminDownloadableController extends Controller
{
    public function index()
    {
        return response()->json(
            Downloadable::query()->orderBy('sort_order')->orderBy('id')->get()
        );
    }

    public function store(Request $request)
    {
        $data = $this->validated($request, null);
        if (empty($data['slug'])) {
            $data['slug'] = Str::slug($data['title']).'-'.Str::lower(Str::random(4));
        }

        $row = Downloadable::query()->create($data);

        return response()->json($row, 201);
    }

    public function update(Request $request, int $id)
    {
        $row = Downloadable::query()->findOrFail($id);
        $data = $this->validated($request, $row->id);
        $row->fill($data);
        $row->save();

        return response()->json($row);
    }

    public function destroy(int $id)
    {
        Downloadable::query()->whereKey($id)->delete();

        return response()->json(['message' => 'Deleted']);
    }

    private function validated(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'title' => 'required|string|max:255',
            'slug' => [
                'nullable',
                'string',
                'max:120',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('downloadables', 'slug')->ignore($id),
            ],
            'description' => 'nullable|string|max:2000',
            'requires_pro' => 'required|boolean',
            'sort_order' => 'required|integer|min:0|max:65535',
            'is_active' => 'required|boolean',
            'body_text' => 'required|string',
            'download_filename' => 'required|string|max:255',
            'mime_type' => 'required|string|max:120',
        ]);
    }
}
