<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('openai_questionnaire_extra_prompts', function (Blueprint $table) {
            $table->string('exam_title', 255)->nullable()->after('body');
            $table->string('test_title', 500)->nullable()->after('exam_title');
            $table->string('section', 32)->nullable()->after('test_title');
            $table->unsignedSmallInteger('celpip_task_number')->nullable()->after('section');
            $table->string('celpip_task_label', 255)->nullable()->after('celpip_task_number');
            $table->string('body_hash', 64)->nullable()->after('celpip_task_label');
        });

        $rows = DB::table('openai_questionnaire_extra_prompts')->orderBy('id')->get(['id', 'body']);
        foreach ($rows as $row) {
            $hash = hash('sha256', trim((string) $row->body));
            DB::table('openai_questionnaire_extra_prompts')->where('id', $row->id)->update(['body_hash' => $hash]);
        }

        $keepIds = DB::table('openai_questionnaire_extra_prompts')
            ->selectRaw('MAX(id) as id')
            ->whereNotNull('body_hash')
            ->groupBy('body_hash')
            ->pluck('id');
        if ($keepIds->isNotEmpty()) {
            DB::table('openai_questionnaire_extra_prompts')->whereNotIn('id', $keepIds)->delete();
        }

        Schema::table('openai_questionnaire_extra_prompts', function (Blueprint $table) {
            $table->index('body_hash');
        });
    }

    public function down(): void
    {
        Schema::table('openai_questionnaire_extra_prompts', function (Blueprint $table) {
            $table->dropIndex(['body_hash']);
            $table->dropColumn([
                'exam_title',
                'test_title',
                'section',
                'celpip_task_number',
                'celpip_task_label',
                'body_hash',
            ]);
        });
    }
};
