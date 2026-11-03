<?php

namespace Database\Factories;

use App\Models\Outlet;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Outlet>
 */
class OutletFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => 'Cabang '.fake()->city(),
            'code' => strtoupper(fake()->unique()->lexify('CBG-???')),
            'address' => fake()->streetAddress(),
            'phone' => fake()->numerify('08##########'),
            'is_main' => false,
            'is_active' => true,
        ];
    }
}
