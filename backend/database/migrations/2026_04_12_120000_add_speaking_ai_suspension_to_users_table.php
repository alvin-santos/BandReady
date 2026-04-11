<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('speaking_ai_suspended_at')->nullable()->after('progress_reminder_sent_at');
            $table->text('speaking_ai_suspension_notice')->nullable()->after('speaking_ai_suspended_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['speaking_ai_suspended_at', 'speaking_ai_suspension_notice']);
        });
    }
};
