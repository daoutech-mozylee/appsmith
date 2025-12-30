package com.appsmith.caching.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * This annotation is used to mark a method to cache the result of a method call.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface Cache {

    /*
     * This is the name of the cache.
     */
    String cacheName();

    /**
     * SPEL expression used to generate the key for the method call
     * All method arguments can be used in the expression
     */
    String key() default "";

    /**
     * Time to live in seconds for the cached entry.
     * Default is 180 seconds (3 minutes).
     * Set to 0 or negative to disable TTL (not recommended).
     */
    long ttlInSeconds() default 180;
}
