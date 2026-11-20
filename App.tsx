/** Reproduces a CSS-animated child freezing when its parent exits on native. */
import {useEffect, useState} from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import Animated, {css, Easing, FadeOut} from 'react-native-reanimated';

const HIDE_AFTER_MS = 2500;
const EXIT_DURATION_MS = 4000;
const EXIT = FadeOut.duration(EXIT_DURATION_MS).easing(Easing.linear);

const animations = css.create({
    indicator: {
        animationName: css.keyframes({from: {left: '0%'}, to: {left: '75%'}}),
        animationDuration: '2000ms',
        animationTimingFunction: 'linear',
        animationDirection: 'alternate',
        animationIterationCount: 'infinite',
    },
});

export default function App() {
    const [run, setRun] = useState(0);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        // Hide mid-animation without needing a precisely timed tap.
        const timeout = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
        return () => clearTimeout(timeout);
    }, [run]);

    function restart() {
        setVisible(true);
        setRun((previous) => previous + 1);
    }

    return (
        <View style={styles.screen}>
            <Text>CSS animation during parent exit</Text>
            <Text>{visible ? 'Both bars are mounted' : 'Bottom bar is exiting for 4 seconds'}</Text>
            <View key={run}>
                <Text>Control: stays mounted</Text>
                <View style={styles.track}>
                    <Animated.View style={[styles.indicator, animations.indicator]} />
                </View>
                <Text>Repro: parent unmounts after 2.5 seconds</Text>
                <View style={styles.slot}>
                    {visible && (
                        <Animated.View exiting={EXIT} style={styles.track}>
                            <Animated.View style={[styles.indicator, animations.indicator]} />
                        </Animated.View>
                    )}
                </View>
            </View>
            <Button title="Restart reproduction" onPress={restart} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {flex: 1, justifyContent: 'center', padding: 24, gap: 24, backgroundColor: 'white'},
    track: {height: 36, backgroundColor: '#dddddd', marginVertical: 12},
    slot: {height: 60},
    indicator: {position: 'absolute', height: 36, width: '25%', backgroundColor: '#008844'},
});
