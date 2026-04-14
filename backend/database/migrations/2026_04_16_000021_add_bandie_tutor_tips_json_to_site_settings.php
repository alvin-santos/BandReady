<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_settings', function (Blueprint $table) {
            $table->json('bandie_tutor_tips_compact')->nullable()->after('bandie_tips_detailed');
            $table->json('bandie_tutor_tips_detailed')->nullable()->after('bandie_tutor_tips_compact');
        });
    }

    public function down(): void
    {
        Schema::table('site_settings', function (Blueprint $table) {
            $table->dropColumn(['bandie_tutor_tips_compact', 'bandie_tutor_tips_detailed']);
        });
    }
};
