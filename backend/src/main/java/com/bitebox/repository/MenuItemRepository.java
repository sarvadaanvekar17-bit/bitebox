package com.bitebox.repository;

import com.bitebox.entity.MenuItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MenuItemRepository extends JpaRepository<MenuItem, Long> {

    List<MenuItem> findByAvailableTrue();

    @Query("SELECT m FROM MenuItem m LEFT JOIN FETCH m.category WHERE m.available = true " +
           "AND (:category IS NULL OR LOWER(m.category.name) = LOWER(:category)) " +
           "AND (:q IS NULL OR LOWER(m.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR LOWER(m.description) LIKE LOWER(CONCAT('%', :q, '%')))")
    List<MenuItem> search(@Param("category") String category, @Param("q") String q);
}
