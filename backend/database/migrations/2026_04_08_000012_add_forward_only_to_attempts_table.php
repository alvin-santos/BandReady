<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attempts', function (Blueprint $table) {
            $table->boolean('forward_only')->default(false)->after('strict_mode');
            $table->unsignedInteger('forward_only_min_allowed_index')->default(0)->after('forward_only');
        });
    }

    public function down(): void
    {
        Schema::table('attempts', function (Blueprint $table) {
            $table->dropColumn(['forward_only', 'forward_only_min_allowed_index']);
        });
    }
};
