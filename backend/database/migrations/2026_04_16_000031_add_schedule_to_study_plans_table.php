<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('study_plans', function (Blueprint $table) {
            $table->string('schedule_mode', 24)->default('everyday')->after('weak_areas');
            $table->json('schedule_custom_days')->nullable()->after('schedule_mode');
            $table->unsignedSmallInteger('study_session_count')->default(0)->after('days_remaining');
        });

        DB::table('study_plans')->update([
            'study_session_count' => DB::raw('days_remaining'),
        ]);
    }

    public function down(): void
    {
        Schema::table('study_plans', function (Blueprint $table) {
            $table->dropColumn(['schedule_mode', 'schedule_custom_days', 'study_session_count']);
        });
    }
};
