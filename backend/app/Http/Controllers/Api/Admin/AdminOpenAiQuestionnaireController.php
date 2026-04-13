<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\OpenAiQuestionnaireService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\Console\Output\BufferedOutput;

class AdminOpenAiQuestionnaireController extends Controller
{
    public function run(Request $request, OpenAiQuestionnaireService $service): JsonResponse
    {
        $validated = $request->validate([
            'sections' => 'sometimes|array',
            'sections.*' => 'string|in:Listening,Reading,Writing,Speaking',
            'questions_per_test' => 'sometimes|nullable|integer|min:1',
            'exam_title' => 'sometimes|string|nullable|max:255',
            'test_title' => 'sometimes|string|nullable|max:500',
            'extra_prompt' => 'sometimes|string|nullable|max:20000',
            'model' => 'sometimes|string|nullable|max:128',
            'dry_run' => 'sometimes|boolean',
            'no_question_preview' => 'sometimes|boolean',
            'with_speaking_images' => 'sometimes|boolean',
            'file_json' => 'sometimes|string|nullable|max:5242880',
        ]);

        $examTitle = trim((string) ($validated['exam_title'] ?? ''));
        $testTitle = trim((string) ($validated['test_title'] ?? ''));
        if (($examTitle === '') !== ($testTitle === '')) {
            return response()->json([
                'ok' => false,
                'message' => 'Provide both exam_title and test_title, or leave both empty.',
            ], 422);
        }

        $sections = $validated['sections'] ?? null;
        if (is_array($sections) && $sections === []) {
            $sections = null;
        }

        $output = new BufferedOutput();
        $output->setDecorated(false);

        $result = $service->runPipeline($output, [
            'file_path' => null,
            'file_content' => (string) ($validated['file_json'] ?? ''),
            'extra_prompt' => (string) ($validated['extra_prompt'] ?? ''),
            'model' => $validated['model'] ?? null,
            'questions_per_test' => $validated['questions_per_test'] ?? null,
            'section' => $sections,
            'exam_title' => $examTitle,
            'test_title' => $testTitle,
            'dry_run' => (bool) ($validated['dry_run'] ?? false),
            'no_question_preview' => (bool) ($validated['no_question_preview'] ?? false),
            'with_speaking_images' => (bool) ($validated['with_speaking_images'] ?? false),
        ]);

        $text = $output->fetch();
        $lines = $text === '' ? [] : preg_split("/\r\n|\n|\r/", $text);

        return response()->json([
            'ok' => $result['code'] === 0,
            'exit_code' => $result['code'],
            'lines' => $lines,
            'payload' => $result['payload'] ?? null,
        ]);
    }
}
