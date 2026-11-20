package com.bitebox.controller;

import com.bitebox.dto.MenuDtos.MenuItemRequest;
import com.bitebox.dto.MenuDtos.MenuItemResponse;
import com.bitebox.service.MenuService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/menu")
public class MenuController {

    private final MenuService menu;

    public MenuController(MenuService menu) {
        this.menu = menu;
    }

    /* Public */
    @GetMapping
    public List<MenuItemResponse> list(@RequestParam(required = false) String category,
                                       @RequestParam(required = false) String q) {
        return menu.list(category, q);
    }

    @GetMapping("/{id}")
    public MenuItemResponse get(@PathVariable Long id) {
        return menu.get(id);
    }

    /* Admin CRUD — guarded by role, not just hidden UI */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public MenuItemResponse create(@Valid @RequestBody MenuItemRequest req) {
        return menu.create(req);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public MenuItemResponse update(@PathVariable Long id, @Valid @RequestBody MenuItemRequest req) {
        return menu.update(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable Long id) {
        menu.delete(id);
    }
}
