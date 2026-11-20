package com.bitebox.service;

import com.bitebox.dto.MenuDtos.MenuItemRequest;
import com.bitebox.dto.MenuDtos.MenuItemResponse;
import com.bitebox.entity.Category;
import com.bitebox.entity.MenuItem;
import com.bitebox.repository.CategoryRepository;
import com.bitebox.repository.MenuItemRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class MenuService {

    private final MenuItemRepository items;
    private final CategoryRepository categories;

    public MenuService(MenuItemRepository items, CategoryRepository categories) {
        this.items = items;
        this.categories = categories;
    }

    @Transactional(readOnly = true)
    public List<MenuItemResponse> list(String category, String q) {
        String cat = (category == null || category.isBlank()) ? null : category;
        String query = (q == null || q.isBlank()) ? null : q.trim();
        return items.search(cat, query).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public MenuItemResponse get(Long id) {
        return toResponse(items.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found.")));
    }

    @Transactional
    public MenuItemResponse create(MenuItemRequest req) {
        MenuItem m = new MenuItem();
        apply(m, req);
        return toResponse(items.save(m));
    }

    @Transactional
    public MenuItemResponse update(Long id, MenuItemRequest req) {
        MenuItem m = items.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found."));
        apply(m, req);
        return toResponse(items.save(m));
    }

    @Transactional
    public void delete(Long id) {
        if (!items.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found.");
        }
        items.deleteById(id);
    }

    private void apply(MenuItem m, MenuItemRequest req) {
        m.setName(req.name().trim());
        m.setDescription(req.description());
        m.setPrice(req.price());
        m.setImageUrl(req.imageUrl());
        m.setAvailable(req.available() == null || req.available());
        m.setRating(req.rating());
        m.setReviews(req.reviews());
        m.setCategory(resolveCategory(req.category()));
    }

    private Category resolveCategory(String name) {
        if (name == null || name.isBlank()) return null;
        return categories.findByNameIgnoreCase(name.trim())
                .orElseGet(() -> {
                    Category c = new Category();
                    c.setName(name.trim());
                    return categories.save(c);
                });
    }

    public MenuItemResponse toResponse(MenuItem m) {
        return new MenuItemResponse(
                m.getId(), m.getName(), m.getDescription(), m.getPrice(),
                m.getCategory() != null ? m.getCategory().getName() : null,
                m.getImageUrl(), m.isAvailable(), m.getRating(), m.getReviews());
    }
}
