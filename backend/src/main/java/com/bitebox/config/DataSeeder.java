package com.bitebox.config;

import com.bitebox.entity.Category;
import com.bitebox.entity.MenuItem;
import com.bitebox.entity.Role;
import com.bitebox.entity.User;
import com.bitebox.repository.CategoryRepository;
import com.bitebox.repository.MenuItemRepository;
import com.bitebox.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Seeds the demo menu (mirrors the static cards on menu.html) and a demo
 * admin account for local development. Idempotent — safe to run every boot.
 *
 * Demo admin: admin@bitebox.demo / admin123  (LOCAL DEV ONLY — change before any real deployment)
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final CategoryRepository categories;
    private final MenuItemRepository items;
    private final UserRepository users;
    private final PasswordEncoder encoder;

    public DataSeeder(CategoryRepository categories, MenuItemRepository items,
                      UserRepository users, PasswordEncoder encoder) {
        this.categories = categories;
        this.items = items;
        this.users = users;
        this.encoder = encoder;
    }

    @Override
    public void run(String... args) {
        seedAdmin();
        if (items.count() > 0) return; // menu already seeded

        record Seed(String name, String desc, String price, String cat, String img, double rating, int reviews) {}
        Seed[] seeds = {
            new Seed("Margherita Pizza", "Classic tomato sauce, fresh mozzarella and basil on a wood-fired base.", "249", "Pizza", "./assets/images/opt/pizza.webp", 4.6, 128),
            new Seed("Cheese Burger", "Juicy grilled patty with melted cheddar, lettuce and house sauce.", "199", "Burger", "./assets/images/opt/burger.webp", 4.4, 96),
            new Seed("Creamy Alfredo Pasta", "Silky parmesan cream sauce tossed with fettuccine.", "229", "Pasta", "./assets/images/opt/pasta.webp", 4.5, 74),
            new Seed("Chicken Biryani", "Fragrant basmati layered with spiced chicken, served with raita.", "279", "Biryani", "./assets/images/opt/chickenbiryani.webp", 4.7, 152),
        };

        for (Seed s : seeds) {
            Category cat = categories.findByNameIgnoreCase(s.cat())
                    .orElseGet(() -> {
                        Category c = new Category();
                        c.setName(s.cat());
                        return categories.save(c);
                    });
            MenuItem m = new MenuItem();
            m.setName(s.name());
            m.setDescription(s.desc());
            m.setPrice(new BigDecimal(s.price()));
            m.setImageUrl(s.img());
            m.setCategory(cat);
            m.setAvailable(true);
            m.setRating(s.rating());
            m.setReviews(s.reviews());
            items.save(m);
        }
        log.info("Seeded {} menu items across {} categories.", seeds.length, categories.count());
    }

    private void seedAdmin() {
        if (users.existsByEmailIgnoreCase("admin@bitebox.demo")) return;
        User admin = new User();
        admin.setName("BiteBox Admin");
        admin.setEmail("admin@bitebox.demo");
        admin.setPasswordHash(encoder.encode("admin123"));
        admin.setRole(Role.ADMIN);
        users.save(admin);
        log.info("Seeded demo admin account (admin@bitebox.demo).");
    }
}
