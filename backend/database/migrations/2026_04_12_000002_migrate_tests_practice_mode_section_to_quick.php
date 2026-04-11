<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('tests')->where('practice_mode', 'section')->update(['practice_mode' => 'quick']);
    }

    public function down(): void
    {
        // Not reversible: former `section` rows cannot be distinguished from native `quick` tests.
    }
};
