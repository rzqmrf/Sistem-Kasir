<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_landing_page_renders_plans_from_database(): void
    {
        $this->withoutVite();

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Welcome')
                ->has('plans', 3)
                ->where('plans.0.code', 'starter')
                ->where('plans.1.code', 'pro')
                ->where('plans.2.code', 'business')
                ->where('trialDays', 14));
    }
}
