<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Question;
use App\Services\OpenAiImageGenerationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AdminQuestionController extends Controller
{
    public function index(Request $request)
    {
        $q = Question::query()->with('test');
        if ($request->filled('test_id')) {
            $q->where('test_id', $request->integer('test_id'));
        }

        return response()->json($q->orderBy('order')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'test_id' => 'required|exists:tests,id',
            'type' => 'required|string|max:64',
            'question_text' => 'required|string',
            'passage_text' => 'nullable|string',
            'audio_url' => 'nullable|string|max:2048',
            'audio_script' => 'nullable|string',
            'image_url' => 'nullable|string|max:2048',
            'options_json' => 'nullable|array',
            'correct_answer' => 'required|string',
            'explanation' => 'nullable|string',
            'order' => 'nullable|integer|min:0',
        ]);

        $question = Question::query()->create($data);

        return response()->json($question, 201);
    }

    public function update(Request $request, int $id)
    {
        $question = Question::query()->findOrFail($id);
        $data = $request->validate([
            'type' => 'sometimes|string|max:64',
            'question_text' => 'sometimes|string',
            'passage_text' => 'nullable|string',
            'audio_url' => 'nullable|string|max:2048',
            'audio_script' => 'nullable|string',
            'image_url' => 'nullable|string|max:2048',
            'options_json' => 'nullable|array',
            'correct_answer' => 'sometimes|string',
            'explanation' => 'nullable|string',
            'order' => 'nullable|integer|min:0',
        ]);
        $question->update($data);

        return response()->json($question);
    }

    public function destroy(int $id)
    {
        Question::query()->whereKey($id)->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Bulk import questions from JSON (e.g. ChatGPT output).
     *
     * Body: {
     *   "test_id": 1,
     *   "replace_existing": false,
     *   "passage_text": "optional shared passage for reading sets",
     *   "questions": [ { "question_text", "options_json", "correct_answer", ... }, ... ]
     * }
     *
     * Extra keys per item (passage_title, …) are ignored. Per-item audio_script is stored for browser TTS.
     */
    public function import(Request $request)
    {
        $payload = $request->validate([
            'test_id' => 'required|exists:tests,id',
            'replace_existing' => 'sometimes|boolean',
            'passage_text' => 'nullable|string',
            'questions' => 'required|array|min:1',
            'questions.*' => 'array',
        ]);

        $testId = (int) $payload['test_id'];
        $replaceExisting = (bool) ($payload['replace_existing'] ?? false);
        $sharedPassage = $payload['passage_text'] ?? null;
        $rawItems = $payload['questions'];

        $allowedKeys = [
            'type',
            'question_text',
            'passage_text',
            'audio_url',
            'audio_script',
            'image_url',
            'options_json',
            'correct_answer',
            'explanation',
            'order',
        ];

        $normalized = [];
        foreach ($rawItems as $index => $row) {
            if (! is_array($row)) {
                return response()->json([
                    'message' => 'Invalid questions array.',
                    'errors' => ['questions.'.$index => ['Each question must be an object.']],
                ], 422);
            }
            $item = [];
            foreach ($allowedKeys as $key) {
                if (array_key_exists($key, $row)) {
                    $item[$key] = $row[$key];
                }
            }
            if ($sharedPassage !== null && empty($item['passage_text'])) {
                $item['passage_text'] = $sharedPassage;
            }
            $item['type'] = isset($item['type']) && is_string($item['type']) ? $item['type'] : 'multiple_choice';
            $item['order'] = isset($item['order']) ? (int) $item['order'] : ($index + 1);
            $item['test_id'] = $testId;

            $validator = Validator::make($item, [
                'test_id' => 'required|exists:tests,id',
                'type' => 'required|string|max:64',
                'question_text' => 'required|string',
                'passage_text' => 'nullable|string',
                'audio_url' => 'nullable|string|max:2048',
                'audio_script' => 'nullable|string',
                'image_url' => 'nullable|string|max:2048',
                'options_json' => 'nullable|array',
                'correct_answer' => 'required|string',
                'explanation' => 'nullable|string',
                'order' => 'nullable|integer|min:0',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed for question index '.$index.'.',
                    'errors' => $validator->errors(),
                    'index' => $index,
                ], 422);
            }

            $normalized[] = $validator->validated();
        }

        $created = DB::transaction(function () use ($normalized, $testId, $replaceExisting) {
            if ($replaceExisting) {
                Question::query()->where('test_id', $testId)->delete();
            }
            $ids = [];
            foreach ($normalized as $data) {
                $q = Question::query()->create($data);
                $ids[] = $q->id;
            }

            return $ids;
        });

        return response()->json([
            'message' => 'Imported '.count($created).' question(s).',
            'imported' => count($created),
            'ids' => $created,
        ], 201);
    }

    /**
     * Generate a scene image (OpenAI) for CELPIP-style picture-speaking tasks and attach it to the question.
     */
    public function generateSpeakingImage(Request $request, int $id)
    {
        $data = $request->validate([
            'prompt' => 'nullable|string|max:4000',
        ]);

        $question = Question::query()->findOrFail($id);
        if ($question->type !== 'speaking_prompt') {
            return response()->json(['message' => 'Only speaking_prompt questions support scene images.'], 422);
        }

        $opts = is_array($question->options_json) ? $question->options_json : [];
        $speaking = isset($opts['speaking']) && is_array($opts['speaking']) ? $opts['speaking'] : [];

        $prompt = isset($data['prompt']) && is_string($data['prompt']) && trim($data['prompt']) !== ''
            ? trim($data['prompt'])
            : (isset($speaking['image_generation_prompt']) ? trim((string) $speaking['image_generation_prompt']) : '');
        if ($prompt === '') {
            return response()->json([
                'message' => 'Set an image prompt on the question (Speaking section) or pass { "prompt": "..." } in the request body.',
            ], 422);
        }

        $this->deleteStoredQuestionImageIfAny($question);

        $svc = app(OpenAiImageGenerationService::class);
        $result = $svc->generateAndStore($prompt);
        $hints = $svc->describeSceneForGrader($prompt);

        $speaking['image_generation_prompt'] = mb_substr($prompt, 0, 2000);
        if ($hints !== '') {
            $speaking['image_context'] = $hints;
        }
        $speaking['image_generated_at'] = now()->toIso8601String();
        $opts['speaking'] = $speaking;

        $question->update([
            'image_url' => $result['public_url'],
            'options_json' => $opts,
        ]);

        return response()->json([
            'image_url' => $result['public_url'],
            'question' => $question->fresh(),
        ]);
    }

    /**
     * Remove generated image from disk and clear image_url.
     */
    public function clearSpeakingImage(int $id)
    {
        $question = Question::query()->findOrFail($id);
        if ($question->type !== 'speaking_prompt') {
            return response()->json(['message' => 'Only speaking_prompt questions support scene images.'], 422);
        }

        $this->deleteStoredQuestionImageIfAny($question);

        $opts = is_array($question->options_json) ? $question->options_json : [];
        if (isset($opts['speaking']) && is_array($opts['speaking'])) {
            unset($opts['speaking']['image_context'], $opts['speaking']['image_generated_at']);
        }

        $question->update([
            'image_url' => null,
            'options_json' => $opts,
        ]);

        return response()->json(['question' => $question->fresh()]);
    }

    private function deleteStoredQuestionImageIfAny(Question $question): void
    {
        app(OpenAiImageGenerationService::class)->deleteByPublicUrl(
            is_string($question->image_url) ? $question->image_url : null
        );
    }
}
