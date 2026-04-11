<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Exam extends Model
{
    protected $fillable = ['name', 'code', 'type'];

    public function sections(): HasMany
    {
        return $this->hasMany(Section::class);
    }

    public function tests(): HasMany
    {
        return $this->hasMany(Test::class);
    }
}
