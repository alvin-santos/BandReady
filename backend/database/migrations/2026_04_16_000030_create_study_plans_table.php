<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('exam_type', 32);
            $table->date('exam_date');
            $table->unsignedSmallInteger('days_remaining');
            $table->string('study_time', 16);
            $table->string('current_level', 32)->nullable();
            $table->json('weak_areas');
            $table->longText('plan_text');
            $table->json('completed_days')->nullable();
            $table->unsignedTinyInteger('regenerate_count_today')->default(0);
            $table->date('regenerate_window_date')->nullable();
            $table->string('plan_pacing', 24)->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_plans');
    }
};
