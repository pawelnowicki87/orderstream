package com.orderstream.restaurant.config;

import com.orderstream.restaurant.domain.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * A demo with an empty database looks broken, so the catalogue is seeded on start.
 * <p>
 * Seeding is idempotent per restaurant and per dish: an existing restaurant is reused and
 * only the dishes it does not have yet are inserted. That way the catalogue can grow without
 * wiping the database, and restarting the service never duplicates anything.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final RestaurantRepository restaurants;
    private final MenuItemRepository menuItems;

    public DataSeeder(RestaurantRepository restaurants, MenuItemRepository menuItems) {
        this.restaurants = restaurants;
        this.menuItems = menuItems;
    }

    /** One menu line, priced in grosze so no money ever touches a floating-point type. */
    private record Dish(String name, String description, long priceCents, boolean available) {

        static Dish of(String name, String description, long priceCents) {
            return new Dish(name, description, priceCents, true);
        }

        static Dish soldOut(String name, String description, long priceCents) {
            return new Dish(name, description, priceCents, false);
        }
    }

    @Override
    public void run(String... args) {
        seed("Pizza Napoli", "Italian",
                "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600",
                List.of(
                        Dish.of("Margherita", "Tomato, mozzarella, basil", 3200),
                        Dish.of("Pepperoni", "Tomato, mozzarella, pepperoni", 3800),
                        Dish.of("Quattro Formaggi", "Four cheeses", 4100),
                        Dish.soldOut("Truffle Special", "Seasonal, currently unavailable", 6500),
                        Dish.of("Prosciutto e Rucola", "Parma ham, rocket, parmesan shavings", 4400),
                        Dish.of("Capricciosa", "Ham, mushrooms, artichokes, olives", 4200),
                        Dish.of("Calzone Classico", "Folded pizza with ricotta and salami", 3900),
                        Dish.of("Garlic Bread", "Baked with olive oil and oregano", 1400),
                        Dish.of("Tiramisu", "Mascarpone, coffee, cocoa", 1900)));

        seed("Sushi Zen", "Japanese",
                "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600",
                List.of(
                        Dish.of("Salmon Nigiri (8 pcs)", "Fresh salmon over rice", 5200),
                        Dish.of("California Roll", "Crab, avocado, cucumber", 3900),
                        Dish.of("Miso Soup", "Tofu, seaweed, spring onion", 1200),
                        Dish.of("Tuna Sashimi (6 pcs)", "Sliced yellowfin tuna", 5800),
                        Dish.of("Dragon Roll", "Eel, cucumber, avocado, unagi sauce", 6200),
                        Dish.of("Chicken Katsu Curry", "Breaded cutlet, rice, curry sauce", 4600),
                        Dish.of("Gyoza (6 pcs)", "Pan-fried pork dumplings", 2400),
                        Dish.of("Edamame", "Steamed soybeans with sea salt", 1500),
                        Dish.soldOut("Otoro Sashimi", "Fatty tuna belly, limited catch", 8900)));

        seed("Burger House", "American",
                "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600",
                List.of(
                        Dish.of("Classic Cheeseburger", "Beef, cheddar, pickles", 3400),
                        Dish.of("Bacon Deluxe", "Beef, bacon, BBQ sauce", 4200),
                        Dish.of("Double Smash", "Two smashed patties, American cheese", 4800),
                        Dish.of("Crispy Chicken Burger", "Buttermilk chicken, slaw", 3900),
                        Dish.of("Beyond Burger", "Plant-based patty, vegan mayo", 4100),
                        Dish.of("Sweet Potato Fries", "With aioli dip", 1800),
                        Dish.of("Onion Rings", "Beer batter, ranch dip", 1600),
                        Dish.of("Buffalo Wings (8 pcs)", "Hot sauce, blue cheese dip", 2900),
                        Dish.of("Oreo Milkshake", "Thick vanilla shake with cookies", 1900)));

        seed("Pho Saigon", "Vietnamese",
                "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=600",
                List.of(
                        Dish.of("Pho Bo", "Beef broth simmered 12 hours, rice noodles", 3600),
                        Dish.of("Pho Ga", "Chicken broth, rice noodles, herbs", 3400),
                        Dish.of("Bun Cha", "Grilled pork, vermicelli, dipping sauce", 3800),
                        Dish.of("Banh Mi Thit", "Baguette, pork, pate, pickled vegetables", 2400),
                        Dish.of("Goi Cuon (4 pcs)", "Fresh summer rolls with peanut sauce", 2200),
                        Dish.of("Com Tam", "Broken rice with grilled pork chop", 3700),
                        Dish.of("Vietnamese Iced Coffee", "Robusta with condensed milk", 1400),
                        Dish.of("Che Ba Mau", "Three-colour bean dessert", 1600)));

        seed("Taco Loco", "Mexican",
                "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600",
                List.of(
                        Dish.of("Tacos al Pastor (3 pcs)", "Marinated pork, pineapple, coriander", 3200),
                        Dish.of("Birria Tacos (3 pcs)", "Slow-cooked beef with consomme", 3900),
                        Dish.of("Quesadilla de Pollo", "Chicken, melted cheese, salsa verde", 3100),
                        Dish.of("Burrito Grande", "Rice, beans, beef, cheese, guacamole", 3800),
                        Dish.of("Nachos con Queso", "Tortilla chips, cheese sauce, jalapenos", 2600),
                        Dish.of("Guacamole & Totopos", "Made to order, fresh lime", 2200),
                        Dish.of("Churros con Chocolate", "Cinnamon sugar, dark chocolate dip", 1800),
                        Dish.of("Horchata", "Rice and cinnamon drink", 1200),
                        Dish.soldOut("Elote", "Grilled corn, cotija, chilli — summer only", 1500)));

        seed("Bombay Spice", "Indian",
                "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600",
                List.of(
                        Dish.of("Butter Chicken", "Tomato and cream sauce, mild", 4200),
                        Dish.of("Chicken Tikka Masala", "Charred chicken in spiced gravy", 4300),
                        Dish.of("Lamb Rogan Josh", "Kashmiri chillies, yoghurt, medium hot", 4900),
                        Dish.of("Palak Paneer", "Spinach and cottage cheese", 3700),
                        Dish.of("Dal Tadka", "Yellow lentils tempered with cumin", 3100),
                        Dish.of("Vegetable Biryani", "Basmati rice, saffron, fried onion", 3600),
                        Dish.of("Garlic Naan", "Tandoor bread with garlic butter", 1200),
                        Dish.of("Mango Lassi", "Yoghurt drink with alphonso mango", 1500),
                        Dish.of("Gulab Jamun (2 pcs)", "Milk dumplings in rose syrup", 1400)));

        seed("Pierogarnia u Babci", "Polish",
                "https://images.unsplash.com/photo-1662116663511-9d79d49da183?w=600",
                List.of(
                        Dish.of("Pierogi ruskie (9 pcs)", "Potato, cottage cheese, fried onion", 2800),
                        Dish.of("Pierogi z miesem (9 pcs)", "Minced meat, served with cracklings", 3100),
                        Dish.of("Pierogi z kapusta i grzybami (9 pcs)", "Sauerkraut and wild mushrooms", 2900),
                        Dish.of("Zurek w chlebie", "Sour rye soup in a bread bowl", 2600),
                        Dish.of("Bigos", "Hunter's stew, slow cooked", 2700),
                        Dish.of("Kotlet schabowy", "Breaded pork with potatoes and salad", 3900),
                        Dish.of("Placki ziemniaczane", "Potato pancakes with sour cream", 2400),
                        Dish.of("Sernik", "Baked cheesecake, grandmother's recipe", 1600),
                        Dish.of("Kompot", "Homemade stewed fruit drink", 900)));

        seed("Green Fork", "Healthy",
                "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600",
                List.of(
                        Dish.of("Buddha Bowl", "Quinoa, chickpeas, roasted vegetables, tahini", 3400),
                        Dish.of("Falafel Wrap", "Hummus, pickles, herb yoghurt", 2900),
                        Dish.of("Acai Bowl", "Acai, banana, granola, berries", 3200),
                        Dish.of("Quinoa Salad", "Feta, pomegranate, mint dressing", 3100),
                        Dish.of("Avocado Toast", "Sourdough, poached egg, chilli flakes", 2300),
                        Dish.of("Hummus & Pita", "Warm pita, olive oil, za'atar", 2100),
                        Dish.of("Overnight Oats", "Oats, almond milk, chia, maple", 1700),
                        Dish.of("Green Detox Smoothie", "Spinach, apple, ginger, lime", 1900)));

        seed("Kebab Stambul", "Turkish",
                "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600",
                List.of(
                        Dish.of("Doner in Pita", "Veal and lamb, salad, garlic sauce", 2400),
                        Dish.of("Doner Plate", "Meat, rice, grilled vegetables, salad", 3400),
                        Dish.of("Adana Kebab", "Hand-minced lamb skewer, sumac onions", 3900),
                        Dish.of("Lahmacun", "Thin flatbread with spiced minced meat", 1900),
                        Dish.of("Falafel Durum", "Rolled wrap, hummus, pickled turnip", 2600),
                        Dish.of("Menemen", "Eggs with tomato and green pepper", 2200),
                        Dish.of("Turkish Rice", "Pilaf with orzo and butter", 1100),
                        Dish.of("Baklava (4 pcs)", "Pistachio, honey syrup", 1800),
                        Dish.of("Ayran", "Salted yoghurt drink", 700)));

        seed("Sweet Corner", "Desserts",
                "https://images.unsplash.com/photo-1568827999250-3f6afff96e66?w=600",
                List.of(
                        Dish.of("New York Cheesecake", "Vanilla, sour cream topping", 1900),
                        Dish.of("Chocolate Lava Cake", "Warm centre, vanilla ice cream", 2100),
                        Dish.of("Belgian Waffle", "Whipped cream and strawberries", 2200),
                        Dish.of("Cinnamon Roll", "Cream cheese frosting", 1400),
                        Dish.of("Macarons (6 pcs)", "Assorted flavours of the week", 2600),
                        Dish.of("Vegan Brownie", "Dark chocolate, walnuts", 1600),
                        Dish.of("Espresso", "Double shot, single origin", 900),
                        Dish.of("Iced Latte", "Cold milk, espresso, ice", 1300),
                        Dish.soldOut("Seasonal Fruit Tart", "Back when the berries are in", 2400)));
    }

    private void seed(String name, String cuisine, String imageUrl, List<Dish> dishes) {
        Restaurant restaurant = restaurants.findByName(name)
                .orElseGet(() -> restaurants.save(new Restaurant(name, cuisine, imageUrl)));

        Set<String> existingDishes = menuItems.findByRestaurantId(restaurant.getId()).stream()
                .map(MenuItem::getName)
                .collect(Collectors.toSet());

        List<MenuItem> missing = dishes.stream()
                .filter(dish -> !existingDishes.contains(dish.name()))
                .map(dish -> new MenuItem(restaurant.getId(), dish.name(), dish.description(),
                        dish.priceCents(), dish.available()))
                .toList();

        if (!missing.isEmpty()) {
            menuItems.saveAll(missing);
            log.info("Seeded {} menu item(s) for {}", missing.size(), name);
        }
    }
}
