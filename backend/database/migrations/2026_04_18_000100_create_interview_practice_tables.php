<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_practice_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('interview_type', 64);
            $table->string('difficulty', 16);
            $table->string('custom_role', 200)->nullable();
            $table->string('status', 32)->default('active');
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('max_duration_seconds');
            $table->unsignedSmallInteger('max_turns');
            $table->unsignedSmallInteger('user_turns')->default(0);
            $table->unsignedSmallInteger('empty_streak')->default(0);
            $table->timestamp('last_ai_at')->nullable();
            $table->json('feedback_json')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'started_at']);
            $table->index(['user_id', 'status']);
        });

        Schema::create('interview_practice_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_practice_session_id')
                ->constrained('interview_practice_sessions')
                ->cascadeOnDelete();
            $table->string('role', 8);
            $table->text('body');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['interview_practice_session_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_practice_messages');
        Schema::dropIfExists('interview_practice_sessions');
    }
};
