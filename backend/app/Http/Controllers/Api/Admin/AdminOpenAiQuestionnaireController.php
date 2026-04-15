<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\OpenaiQuestionnaireExtraPrompt;
use App\Services\OpenAiQuestionnaireService;
use App\Support\CelpipOfficialTaskCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\Console\Output\BufferedOutput;

class AdminOpenAiQuestionnaireController extends Controller
{
    private const EXTRA_PROMPT_MAX = 20000;

    private const EXTRA_PROMPT_HISTORY_LIMIT = 50;

    private const EXTRA_PROMPT_LIST_MAX = 500;

    /** @var list<string> */
    private const SECTION_VALUES = ['Listening', 'Reading', 'Writing', 'Speaking'];

    public function extraPromptsIndex(Request $request): JsonResponse
    {
        $limit = self::EXTRA_PROMPT_HISTORY_LIMIT;
        $raw = $request->query('limit');
        if ($raw !== null && $raw !== '') {
            $limit = min(self::EXTRA_PROMPT_LIST_MAX, max(1, (int) $raw));
        }

        $rows = OpenaiQuestionnaireExtraPrompt::query()
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        $items = $rows->map(fn (OpenaiQuestionnaireExtraPrompt $row) => $this->formatExtraPromptItem($row));

        return response()->json(['items' => $items]);
    }

    public function extraPromptsShow(int $id): JsonResponse
    {
        $row = OpenaiQuestionnaireExtraPrompt::query()->find($id);

        return $row === null
            ? response()->json(['message' => 'Not found.'], 404)
            : response()->json(['item' => $this->formatExtraPromptItem($row)]);
    }

    public function extraPromptsUpdate(Request $request, int $id): JsonResponse
    {
        $row = OpenaiQuestionnaireExtraPrompt::query()->find($id);
        if ($row === null) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $validated = $request->validate([
            'body' => 'required|string|max:'.self::EXTRA_PROMPT_MAX,
            'exam_title' => 'nullable|string|max:255',
            'test_title' => 'nullable|string|max:500',
            'section' => 'nullable|string|in:'.implode(',', self::SECTION_VALUES),
            'celpip_task_number' => 'nullable|integer|min:1|max:99',
            'celpip_task_label' => 'nullable|string|max:255',
        ]);
        $body = trim($validated['body']);
        if ($body === '') {
            return response()->json(['message' => 'body must not be empty.'], 422);
        }
        $hash = hash('sha256', $body);
        $conflict = OpenaiQuestionnaireExtraPrompt::query()
            ->where('body_hash', $hash)
            ->where('id', '!=', $row->id)
            ->first();
        if ($conflict !== null) {
            return response()->json([
                'message' => 'Another saved prompt already uses this exact text (id '.$conflict->id.'). Edit or delete that row first.',
            ], 422);
        }

        $context = $this->normalizeExtraPromptContextFromInput([
            'exam_title' => $validated['exam_title'] ?? null,
            'test_title' => $validated['test_title'] ?? null,
            'section' => $validated['section'] ?? null,
            'celpip_task_number' => $validated['celpip_task_number'] ?? null,
            'celpip_task_label' => $validated['celpip_task_label'] ?? null,
        ]);
        $row->fill(array_merge(
            [
                'body' => $body,
                'body_hash' => $hash,
            ],
            $context
        ));
        $row->save();

        return response()->json(['item' => $this->formatExtraPromptItem($row->fresh())]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatExtraPromptItem(OpenaiQuestionnaireExtraPrompt $row): array
    {
        $body = (string) $row->body;
        $preview = mb_substr(preg_replace('/\s+/u', ' ', trim($body)) ?? '', 0, 120);

        return [
            'id' => $row->id,
            'body' => $body,
            'preview' => $preview,
            'exam_title' => $row->exam_title,
            'test_title' => $row->test_title,
            'section' => $row->section,
            'celpip_task_number' => $row->celpip_task_number,
            'celpip_task_label' => $row->celpip_task_label,
            'created_at' => $row->created_at?->toIso8601String(),
            'updated_at' => $row->updated_at?->toIso8601String(),
        ];
    }

    public function extraPromptsStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'body' => 'required|string|max:'.self::EXTRA_PROMPT_MAX,
            'exam_title' => 'sometimes|nullable|string|max:255',
            'test_title' => 'sometimes|nullable|string|max:500',
            'section' => 'sometimes|nullable|string|in:'.implode(',', self::SECTION_VALUES),
            'celpip_task_number' => 'sometimes|nullable|integer|min:1|max:99',
            'celpip_task_label' => 'sometimes|nullable|string|max:255',
        ]);
        $body = trim($validated['body']);
        if ($body === '') {
            return response()->json(['message' => 'body must not be empty.'], 422);
        }
        $context = $this->normalizeExtraPromptContextFromInput($validated);
        $this->rememberExtraPrompt($body, $context);

        return response()->json(['ok' => true], 201);
    }

    public function extraPromptsDestroy(int $id): JsonResponse
    {
        $deleted = OpenaiQuestionnaireExtraPrompt::query()->whereKey($id)->delete();

        return $deleted > 0
            ? response()->json(['ok' => true])
            : response()->json(['message' => 'Not found.'], 404);
    }

    /**
     * Upsert by SHA-256 of trimmed body so the same instructions are not duplicated;
     * refreshing metadata updates the existing row and bumps updated_at.
     *
     * @param  array{exam_title: ?string, test_title: ?string, section: ?string, celpip_task_number: ?int, celpip_task_label: ?string}  $context
     */
    private function rememberExtraPrompt(string $trimmedBody, array $context): void
    {
        if ($trimmedBody === '') {
            return;
        }
        $hash = hash('sha256', $trimmedBody);
        OpenaiQuestionnaireExtraPrompt::query()->updateOrCreate(
            ['body_hash' => $hash],
            array_merge(
                [
                    'body' => $trimmedBody,
                    'body_hash' => $hash,
                ],
                $context
            )
        );
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{exam_title: ?string, test_title: ?string, section: ?string, celpip_task_number: ?int, celpip_task_label: ?string}
     */
    private function extraPromptContextFromRunValidated(array $validated): array
    {
        $exam = trim((string) ($validated['exam_title'] ?? ''));
        $test = trim((string) ($validated['test_title'] ?? ''));
        $sections = $validated['sections'] ?? null;
        $section = null;
        if (is_array($sections) && count($sections) === 1 && is_string($sections[0])) {
            $section = $sections[0];
        }

        $celpip = $validated['celpip_section_tasks'] ?? null;
        $num = null;
        $label = null;
        if (is_array($celpip) && count($celpip) >= 1) {
            $secName = array_key_first($celpip);
            if (is_string($secName) && isset(CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$secName])) {
                $ids = $celpip[$secName];
                if (is_array($ids) && count($ids) >= 1) {
                    $first = $ids[0];
                    if (is_numeric($first)) {
                        $n = (int) $first;
                        if ($n >= 1 && isset(CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$secName][$n])) {
                            $num = $n;
                            $label = CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$secName][$n];
                        }
                    }
                }
            }
        }

        return [
            'exam_title' => $exam === '' ? null : mb_substr($exam, 0, 255),
            'test_title' => $test === '' ? null : mb_substr($test, 0, 500),
            'section' => is_string($section) && in_array($section, self::SECTION_VALUES, true) ? $section : null,
            'celpip_task_number' => $num,
            'celpip_task_label' => $label,
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array{exam_title: ?string, test_title: ?string, section: ?string, celpip_task_number: ?int, celpip_task_label: ?string}
     */
    private function normalizeExtraPromptContextFromInput(array $input): array
    {
        $exam = isset($input['exam_title']) && is_string($input['exam_title']) ? trim($input['exam_title']) : '';
        $test = isset($input['test_title']) && is_string($input['test_title']) ? trim($input['test_title']) : '';
        $section = isset($input['section']) && is_string($input['section']) ? trim($input['section']) : '';
        if ($section === '' || ! in_array($section, self::SECTION_VALUES, true)) {
            $section = null;
        }
        $num = null;
        if (isset($input['celpip_task_number']) && is_numeric($input['celpip_task_number'])) {
            $n = (int) $input['celpip_task_number'];
            if ($n >= 1 && $n <= 99) {
                $num = $n;
            }
        }
        $label = isset($input['celpip_task_label']) && is_string($input['celpip_task_label'])
            ? trim($input['celpip_task_label'])
            : '';
        if ($label === '') {
            $label = null;
        }
        if ($num !== null && $section !== null && $label === null) {
            $label = CelpipOfficialTaskCatalog::TASKS_BY_SECTION[$section][$num] ?? null;
        }
        if ($num !== null && $section === null) {
            $num = null;
        }

        return [
            'exam_title' => $exam === '' ? null : mb_substr($exam, 0, 255),
            'test_title' => $test === '' ? null : mb_substr($test, 0, 500),
            'section' => $section,
            'celpip_task_number' => $num,
            'celpip_task_label' => $label,
        ];
    }

    public function run(Request $request, OpenAiQuestionnaireService $service): JsonResponse
    {
        $validated = $request->validate([
            'sections' => 'sometimes|array|max:1',
            'sections.*' => 'string|in:Listening,Reading,Writing,Speaking',
            'questions_per_test' => 'sometimes|nullable|integer|min:1',
            'exam_title' => 'sometimes|string|nullable|max:255',
            'test_title' => 'sometimes|string|nullable|max:500',
            'extra_prompt' => 'sometimes|string|nullable|max:20000',
            'model' => 'sometimes|string|nullable|max:128',
            'dry_run' => 'sometimes|boolean',
            'no_question_preview' => 'sometimes|boolean',
            'with_speaking_images' => 'sometimes|boolean',
            'omit_passage_text' => 'sometimes|boolean',
            'file_json' => 'sometimes|string|nullable|max:5242880',
            'celpip_section_tasks' => 'sometimes|nullable|array',
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

        $output = new BufferedOutput;
        $output->setDecorated(false);

        $celpipTasks = $validated['celpip_section_tasks'] ?? null;
        if (is_array($celpipTasks) && $celpipTasks === []) {
            $celpipTasks = null;
        }

        $extraPromptRaw = (string) ($validated['extra_prompt'] ?? '');
        $extraPromptTrimmed = trim($extraPromptRaw);

        $result = $service->runPipeline($output, [
            'file_path' => null,
            'file_content' => (string) ($validated['file_json'] ?? ''),
            'extra_prompt' => $extraPromptRaw,
            'model' => $validated['model'] ?? null,
            'questions_per_test' => $validated['questions_per_test'] ?? null,
            'section' => $sections,
            'exam_title' => $examTitle,
            'test_title' => $testTitle,
            'dry_run' => (bool) ($validated['dry_run'] ?? false),
            'no_question_preview' => (bool) ($validated['no_question_preview'] ?? false),
            'with_speaking_images' => (bool) ($validated['with_speaking_images'] ?? false),
            'omit_passage_text' => (bool) ($validated['omit_passage_text'] ?? false),
            'celpip_section_tasks' => is_array($celpipTasks) ? $celpipTasks : null,
        ]);

        $dryRun = (bool) ($validated['dry_run'] ?? false);
        if ($result['code'] === 0 && $extraPromptTrimmed !== '' && ! $dryRun) {
            $this->rememberExtraPrompt($extraPromptTrimmed, $this->extraPromptContextFromRunValidated($validated));
        }

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
