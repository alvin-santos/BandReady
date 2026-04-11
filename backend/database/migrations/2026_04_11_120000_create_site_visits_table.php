<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_visits', function (Blueprint $table) {
            $table->id();
            $table->uuid('visitor_id');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('path', 512);
            $table->string('referrer', 1024)->nullable();
            $table->timestamps();

            $table->index('created_at');
            $table->index(['visitor_id', 'created_at']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_visits');
    }
};
