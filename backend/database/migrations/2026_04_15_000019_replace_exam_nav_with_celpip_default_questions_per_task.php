<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_settings', function (Blueprint $table) {
            if (Schema::hasColumn('site_settings', 'exam_nav_max_questions_per_task')) {
                $table->dropColumn('exam_nav_max_questions_per_task');
            }
        });
        Schema::table('site_settings', function (Blueprint $table) {
            $table->json('celpip_default_questions_per_task')->nullable()->after('bandie_tutor_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('site_settings', function (Blueprint $table) {
            $table->dropColumn('celpip_default_questions_per_task');
        });
        Schema::table('site_settings', function (Blueprint $table) {
            $table->unsignedSmallInteger('exam_nav_max_questions_per_task')->nullable()->after('bandie_tutor_enabled');
        });
    }
};
